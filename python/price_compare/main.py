from __future__ import annotations

import asyncio
import json
import secrets
from contextlib import asynccontextmanager, suppress
from datetime import date, datetime, timezone
from typing import Any
from decimal import Decimal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select

from .adapters import EbayAdapter
from .config import ROOT, Settings, settings
from .fixtures import demo_offers
from .importers import parse_import
from .matching import normalized_request
from .models import Favorite, ImportRecord, Offer, Recommendation, SearchRun, make_session
from .schemas import FavoriteRequest, FavoriteUpdate, ImportRequest, NormalizedOffer, SearchRequest, SearchResponse
from .scoring import rank_offers
from .investment import investment_router
from .investment_data import InvestmentSync


def create_app(config: Settings = settings) -> FastAPI:
    factory, _engine = make_session(config.database_url)
    investment_sync = InvestmentSync(factory, config, env_file=ROOT / ".env" if config is settings else None)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        task = asyncio.create_task(investment_sync.run()) if investment_sync.enabled or investment_sync.env_file is not None else None
        try:
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            await investment_sync.close()
            _engine.dispose()

    app = FastAPI(title="VaultFolio Price Compare", version="0.1.0", lifespan=lifespan)
    app.state.investment_sync = investment_sync

    def scope(authorization: str | None = Header(default=None), x_user_id: int | None = Header(default=None), x_project_id: int | None = Header(default=None)) -> tuple[int, int]:
        if not config.internal_token or authorization != f"Bearer {config.internal_token}":
            raise HTTPException(status_code=401, detail="内部服务认证失败")
        if not x_user_id or x_user_id <= 0 or not x_project_id or x_project_id <= 0:
            raise HTTPException(status_code=400, detail="缺少用户或项目范围")
        return x_user_id, x_project_id

    app.include_router(investment_router(factory, scope, investment_sync))

    def to_json(offer: NormalizedOffer) -> dict[str, Any]:
        raw = offer.model_dump(mode="python", by_alias=True, exclude_none=False)
        def numbers(value: Any) -> Any:
            if isinstance(value, Decimal):
                return float(value)
            if isinstance(value, (datetime, date)):
                return value.isoformat()
            if isinstance(value, dict):
                return {key: numbers(item) for key, item in value.items()}
            if isinstance(value, list):
                return [numbers(item) for item in value]
            return value
        return numbers(raw)

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "请求失败"
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": "UPSTREAM_ERROR" if exc.status_code >= 500 else "VALIDATION_ERROR", "message": message}})

    @app.exception_handler(ValueError)
    async def value_error(_request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"error": {"code": "VALIDATION_ERROR", "message": str(exc)}})

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/providers")
    async def providers(_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        result = [EbayAdapter(config).capabilities()]
        for platform, name in [("jd", "京东"), ("pinduoduo", "拼多多"), ("douyin", "抖音电商"), ("goofish", "闲鱼")]:
            result.append({"platform": platform, "name": name, "status": "unavailable", "reason": "未配置经授权的开放平台接口", "fallback": "manual_import", "automaticSearch": False})
        result.append({"platform": "demo", "name": "本地演示数据", "status": "available", "reason": "固定合成样例", "fallback": None, "automaticSearch": True})
        return {"providers": result}

    @app.post("/search", response_model=SearchResponse)
    async def search(request: SearchRequest, user_scope: tuple[int, int] = Depends(scope)) -> SearchResponse:
        user_id, project_id = user_scope
        request = normalized_request(request)
        run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(3)}"
        offers: list[NormalizedOffer] = []
        provider_status: dict[str, Any] = {}
        if request.mode == "demo":
            offers.extend(demo_offers(request))
            provider_status["demo"] = {"status": "available", "reason": "固定演示数据"}
        if "ebay" in request.platforms and request.mode == "live":
            adapter = EbayAdapter(config)
            provider_status["ebay"] = adapter.capabilities()
            if adapter.capabilities()["automaticSearch"]:
                try:
                    offers.extend(await adapter.search(request))
                except Exception:
                    provider_status["ebay"] = {**adapter.capabilities(), "status": "error", "reason": "官方接口暂时不可用", "fallback": "manual_import"}
        # Manual quotes are private snapshots. Live searches may combine them
        # with authorized adapters, while demo searches remain deterministic.
        if request.mode == "live":
            with factory() as db:
                imported = db.scalars(select(ImportRecord).where(
                    ImportRecord.user_id == user_id,
                    ImportRecord.project_id == project_id,
                )).all()
                for record in imported:
                    if record.platform not in request.platforms:
                        continue
                    try:
                        offers.append(NormalizedOffer.model_validate(json.loads(record.offer_json)))
                    except (ValueError, TypeError):
                        continue
        for platform in request.platforms:
            if platform not in provider_status:
                provider_status[platform] = {"status": "unavailable", "reason": "未配置经授权的开放平台接口", "fallback": "manual_import"}
        for platform, provider in provider_status.items():
            provider["platform"] = platform
        # A manually imported snapshot should not be duplicated when a demo or
        # live adapter returns the same external listing.
        unique: dict[tuple[str, str], NormalizedOffer] = {}
        for offer in offers:
            unique[(offer.platform, offer.external_id)] = offer
        # Rank the full candidate set before limiting displayed snapshots so
        # unrelated older imports cannot hide matching goods beyond the limit.
        ranked = rank_offers(request, list(unique.values()))[:config.max_results]
        recommendations = [row for row in ranked if row.eligible][:3]
        status = "completed" if ranked else "empty"
        with factory() as db:
            snapshot_request = request.model_dump(mode="json", by_alias=True)
            snapshot_request["_providerStatus"] = provider_status
            run = SearchRun(id=run_id, user_id=user_id, project_id=project_id, query=request.query, request_json=json.dumps(snapshot_request, ensure_ascii=False), status=status, completed_at=datetime.now(timezone.utc))
            db.add(run)
            db.flush()
            db_offers: dict[int, Offer] = {}
            for row in ranked:
                record = Offer(run_id=run_id, user_id=user_id, project_id=project_id, data_json=json.dumps(to_json(row), ensure_ascii=False), landed_price=float(row.landed_price) if row.landed_price is not None else None, match_level=row.match_level, data_completeness=row.data_completeness, fetched_at=row.source_fetched_at)
                db.add(record)
                db.flush()
                row.id = record.id
                db_offers[id(row)] = record
            for rank, row in enumerate(recommendations, 1):
                record = db_offers[id(row)]
                row.rank = rank
                record.data_json = json.dumps(to_json(row), ensure_ascii=False)
                db.add(Recommendation(run_id=run_id, offer_id=record.id, rank=rank, score=row.scores.get("total") or 0, reason_json=json.dumps({"reasons": row.reasons, "risks": row.risks}, ensure_ascii=False)))
            for row in ranked:
                if id(row) in db_offers and row.rank is None:
                    db_offers[id(row)].data_json = json.dumps(to_json(row), ensure_ascii=False)
            db.commit()
        payload = {"runId": run_id, "status": status, "request": request.model_dump(mode="json", by_alias=True), "summary": {"matchedCount": len(ranked), "exactMatchCount": sum(row.match_level == "exact" for row in ranked), "providerStatus": provider_status}, "recommendations": [to_json(item) for item in recommendations], "offers": [to_json(item) for item in ranked]}
        return JSONResponse(content=payload)  # type: ignore[return-value]

    @app.get("/runs")
    async def runs(user_scope: tuple[int, int] = Depends(scope)) -> list[dict[str, Any]]:
        user_id, project_id = user_scope
        with factory() as db:
            rows = db.scalars(select(SearchRun).where(SearchRun.user_id == user_id, SearchRun.project_id == project_id).order_by(SearchRun.created_at.desc()).limit(50)).all()
            return [{"runId": row.id, "query": row.query, "createdAt": row.created_at.isoformat(), "mode": json.loads(row.request_json).get("mode", "demo"), "exactMatchCount": sum(offer.match_level == "exact" for offer in row.offers)} for row in rows]

    @app.get("/runs/{run_id}")
    async def run_detail(run_id: str, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        user_id, project_id = user_scope
        with factory() as db:
            row = db.scalar(select(SearchRun).where(SearchRun.id == run_id, SearchRun.user_id == user_id, SearchRun.project_id == project_id))
            if not row:
                raise HTTPException(404, "比价记录不存在")
            offers = [json.loads(offer.data_json) | {"id": offer.id} for offer in row.offers]
            recommendations = sorted([item for item in offers if item.get("rank")], key=lambda item: item["rank"])
            saved_request = json.loads(row.request_json)
            provider_status = saved_request.pop("_providerStatus", {})
            return {"runId": row.id, "status": row.status, "request": saved_request, "summary": {"matchedCount": len(offers), "exactMatchCount": sum(item.get("matchLevel") == "exact" for item in offers), "providerStatus": provider_status}, "offers": offers, "recommendations": recommendations}

    @app.post("/imports")
    async def imports(request: ImportRequest, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        user_id, project_id = user_scope
        offers = parse_import(request)
        with factory() as db:
            records = []
            for offer in offers:
                record = ImportRecord(user_id=user_id, project_id=project_id, platform=offer.platform, source_url=offer.url, offer_json=json.dumps(to_json(offer), ensure_ascii=False))
                db.add(record)
                records.append(record)
            db.commit()
            return {"count": len(records), "imports": [{"id": item.id, "offer": to_json(offer)} for item, offer in zip(records, offers)]}

    @app.get("/imports")
    async def list_imports(user_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        user_id, project_id = user_scope
        with factory() as db:
            rows = db.scalars(select(ImportRecord).where(ImportRecord.user_id == user_id, ImportRecord.project_id == project_id).order_by(ImportRecord.created_at.desc())).all()
            return {"imports": [{"id": row.id, "platform": row.platform, "createdAt": row.created_at.isoformat(), "offer": json.loads(row.offer_json)} for row in rows]}

    @app.put("/imports/{import_id}")
    async def update_import(import_id: int, request: ImportRequest, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        user_id, project_id = user_scope
        offers = parse_import(request)
        if len(offers) != 1:
            raise HTTPException(400, "编辑导入记录时只能提交一条商品")
        with factory() as db:
            row = db.scalar(select(ImportRecord).where(ImportRecord.id == import_id, ImportRecord.user_id == user_id, ImportRecord.project_id == project_id))
            if not row:
                raise HTTPException(404, "导入记录不存在")
            row.platform, row.source_url, row.offer_json = offers[0].platform, offers[0].url, json.dumps(to_json(offers[0]), ensure_ascii=False)
            db.commit()
            return {"id": row.id, "offer": to_json(offers[0])}

    @app.delete("/imports/{import_id}")
    async def delete_import(import_id: int, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, bool]:
        user_id, project_id = user_scope
        with factory() as db:
            row = db.scalar(select(ImportRecord).where(ImportRecord.id == import_id, ImportRecord.user_id == user_id, ImportRecord.project_id == project_id))
            if not row:
                raise HTTPException(404, "导入记录不存在")
            db.delete(row); db.commit(); return {"ok": True}

    @app.get("/favorites")
    async def list_favorites(user_scope: tuple[int, int] = Depends(scope)) -> list[dict[str, Any]]:
        user_id, project_id = user_scope
        with factory() as db:
            rows = db.scalars(select(Favorite).where(Favorite.user_id == user_id, Favorite.project_id == project_id).order_by(Favorite.created_at.desc())).all()
            result = []
            for row in rows:
                offer = db.get(Offer, row.offer_id)
                if offer: result.append({"id": row.id, "offer": json.loads(offer.data_json) | {"id": offer.id}, "note": row.note, "createdAt": row.created_at.isoformat()})
            return result

    @app.post("/favorites")
    async def add_favorite(request: FavoriteRequest, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        user_id, project_id = user_scope
        with factory() as db:
            offer = db.scalar(select(Offer).where(Offer.id == request.offer_id, Offer.user_id == user_id, Offer.project_id == project_id))
            if not offer: raise HTTPException(404, "商品不存在或不属于当前用户")
            row = Favorite(user_id=user_id, project_id=project_id, offer_id=offer.id, note=request.note); db.add(row); db.commit()
            return {"id": row.id, "offer": json.loads(offer.data_json) | {"id": offer.id}, "note": row.note, "createdAt": row.created_at.isoformat()}

    @app.put("/favorites/{favorite_id}")
    async def update_favorite(favorite_id: int, request: FavoriteUpdate, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, Any]:
        user_id, project_id = user_scope
        with factory() as db:
            row = db.scalar(select(Favorite).where(Favorite.id == favorite_id, Favorite.user_id == user_id, Favorite.project_id == project_id))
            if not row: raise HTTPException(404, "收藏不存在")
            row.note = request.note; db.commit(); return {"id": row.id, "note": row.note}

    @app.delete("/favorites/{favorite_id}")
    async def delete_favorite(favorite_id: int, user_scope: tuple[int, int] = Depends(scope)) -> dict[str, bool]:
        user_id, project_id = user_scope
        with factory() as db:
            row = db.scalar(select(Favorite).where(Favorite.id == favorite_id, Favorite.user_id == user_id, Favorite.project_id == project_id))
            if not row: raise HTTPException(404, "收藏不存在")
            db.delete(row); db.commit(); return {"ok": True}

    return app


app = create_app()
