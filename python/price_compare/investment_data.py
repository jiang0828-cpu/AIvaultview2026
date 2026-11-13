from __future__ import annotations

import asyncio
import json
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal

import httpx
from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import String, Text, select
from sqlalchemy.orm import Mapped, mapped_column

from .models import Base

CHINA = timezone(timedelta(hours=8))
CHANNELS = [
    ("天天基金官方", "https://www.1234567.com.cn/"),
    ("华泰证券官方", "https://www.htsc.com.cn/"),
    ("上交所 ETF", "https://www.sse.com.cn/assortment/fund/etf/home/"),
    ("巨潮资讯", "https://www.cninfo.com.cn/"),
    ("中债收益率曲线", "https://yield.chinabond.com.cn/"),
]


class InvestmentDataCache(Base):
    __tablename__ = "investment_data_cache"
    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    payload: Mapped[str] = mapped_column(Text)


class MarketSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    providerCode: str
    status: Literal["ready", "stale", "blocked", "error", "pending"] = "pending"
    reason: str = "等待首次同步"
    kind: Literal["close", "nav", "realtime"] = "nav"
    price: Decimal | None = Field(default=None, gt=0, le=1e9)
    priceDate: date | None = None
    sourceTime: datetime | None = None
    publishedOn: date | None = None
    fetchedAt: datetime | None = None
    navFetchedAt: datetime | None = None
    feesFetchedAt: datetime | None = None
    lastAttemptAt: datetime | None = None
    expectedDate: date | None = None
    unitNav: Decimal | None = Field(default=None, gt=0, le=1e9)
    navDate: date | None = None
    turnover: Decimal | None = Field(default=None, ge=0, le=1e18)
    premium: float | None = Field(default=None, ge=-100, le=1000)
    return1y: float | None = Field(default=None, ge=-100, le=1000)
    drawdown1y: float | None = Field(default=None, ge=0, le=100)
    period: str = "复权净值历史不足，未计算"
    managementFee: float | None = Field(default=None, ge=0, le=10)
    custodyFee: float | None = Field(default=None, ge=0, le=10)
    warnings: list[str] = Field(default_factory=list)
    sourceUrl: str = "https://tushare.pro/document/2?doc_id=119"


def provider_code(product: dict[str, Any]) -> str | None:
    if product.get("category") not in {"etf", "equity_fund", "bond_fund", "money_fund"}:
        return None
    explicit = product.get("dataCode")
    if explicit:
        return explicit if re.fullmatch(r"\d{6}\.(SH|SZ|OF)", explicit) else None
    code = str(product.get("code", ""))
    if not re.fullmatch(r"\d{6}", code):
        return None
    if product.get("category") == "etf":
        if code.startswith("5"):
            return f"{code}.SH"
        if code.startswith("15"):
            return f"{code}.SZ"
    # Off-exchange fund identifiers must be confirmed instead of guessed.
    return None


def check_prices(rows: list[dict[str, Any]], day_field: str, price_field: str) -> None:
    seen: dict[str, Decimal] = {}
    for row in rows:
        day = str(row[day_field])
        value = Decimal(str(row[price_field]))
        if not value.is_finite() or value <= 0 or day in seen and seen[day] != value:
            raise ValueError("价格无效或同日数据冲突")
        seen[day] = value


def check_change(price: Any, previous: Any) -> None:
    current, prior = Decimal(str(price)), Decimal(str(previous))
    if not current.is_finite() or not prior.is_finite() or current <= 0 or prior <= 0 or abs(current/prior-1) > Decimal("0.3"):
        raise ValueError("价格变化异常，需人工核实除权或数据问题")


def history_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    values: dict[date, Decimal] = {}
    for row in rows:
        if row.get("adj_nav") is None:
            continue
        day = datetime.strptime(str(row["nav_date"]), "%Y%m%d").date()
        value = Decimal(str(row["adj_nav"]))
        if not value.is_finite() or value <= 0:
            raise ValueError("复权净值异常")
        if day in values and values[day] != value:
            raise ValueError("同日复权净值冲突")
        values[day] = value
    if not values:
        return {}
    end = max(values)
    start = end-timedelta(days=365)
    anchors = [day for day in values if start-timedelta(days=7) <= day <= start]
    if not anchors:
        return {}
    anchor = max(anchors)
    points = sorted((day, value) for day, value in values.items() if day >= anchor)
    if len(points) < 200 or any((b[0]-a[0]).days > 20 for a, b in zip(points, points[1:])):
        return {}
    for first, second in zip(points, points[1:]):
        if (second[0]-first[0]).days <= 4:
            check_change(second[1], first[1])
    peak = points[0][1]
    drawdown = Decimal(0)
    for _, value in points:
        peak = max(peak, value)
        drawdown = max(drawdown, 1-value/peak)
    return {"return1y": round(float(points[-1][1]/points[0][1]-1)*100, 4),
            "drawdown1y": round(float(drawdown)*100, 4), "period": f"{anchor} 至 {end} · 复权净值"}


class InvestmentSync:
    def __init__(self, factory: Any, config: Any, client: httpx.AsyncClient | None = None, clock: Any = None, request_pause: float = .75, env_file: Path | None = None):
        self.factory = factory
        self.enabled = config.investment_auto_update
        self.token = config.tushare_token
        self.realtime = config.investment_realtime
        self.interval = config.investment_interval
        self.client = client or httpx.AsyncClient(timeout=8, follow_redirects=False, trust_env=False)
        self.owns_client = client is None
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.lock = asyncio.Lock()
        self.request_lock = asyncio.Lock()
        self.wake = asyncio.Event()
        self.last_cycle: str | None = None
        self.service_error: str | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self.api_cache: dict[str, tuple[datetime, list[dict[str, Any]]]] = {}
        self.request_pause = request_pause
        self.env_file = env_file
        self.initial_token = self.token

    def reload_config(self) -> None:
        if self.env_file is None:
            return
        values = dotenv_values(self.env_file)
        interval = int(values.get("INVESTMENT_UPDATE_INTERVAL_SECONDS") or self.interval)
        if not 300 <= interval <= 86400:
            raise ValueError("自动同步间隔配置无效")
        token = values.get("TUSHARE_TOKEN", self.initial_token) or ""
        if token != self.token:
            self.api_cache.clear()
            # A newly authorized credential should not inherit the old error backoff.
            with self.factory() as db:
                for row in db.scalars(select(InvestmentDataCache).where(InvestmentDataCache.key.like("market:%") | (InvestmentDataCache.key == "calendar"))):
                    value = json.loads(row.payload)
                    value["lastAttemptAt"] = None
                    row.payload = json.dumps(value, ensure_ascii=False)
                db.commit()
        self.token = token
        self.interval = interval
        self.enabled = (values.get("INVESTMENT_AUTO_UPDATE") or str(self.enabled)).lower() == "true"
        self.realtime = (values.get("INVESTMENT_REALTIME_ENABLED") or str(self.realtime)).lower() == "true"

    def request_refresh(self) -> None:
        if self.loop and not self.loop.is_closed():
            self.loop.call_soon_threadsafe(self.wake.set)

    def cache(self, key: str) -> dict[str, Any]:
        with self.factory() as db:
            row = db.get(InvestmentDataCache, key)
            return json.loads(row.payload) if row else {}

    def put(self, key: str, value: dict[str, Any]) -> None:
        with self.factory() as db:
            row = db.get(InvestmentDataCache, key)
            payload = json.dumps(value, ensure_ascii=False, allow_nan=False)
            if row:
                row.payload = payload
            else:
                db.add(InvestmentDataCache(key=key, payload=payload))
            db.commit()

    def due(self, value: dict[str, Any], seconds: int) -> bool:
        stamp = value.get("lastAttemptAt") or value.get("checkedAt")
        return not stamp or (self.clock()-datetime.fromisoformat(stamp)).total_seconds() >= seconds

    async def api(self, name: str, params: dict[str, Any], fields: str) -> list[dict[str, Any]]:
        # Fixed HTTPS destination. Provider messages may contain credentials and are never forwarded.
        async with self.request_lock:
            for attempt in range(2):
                try:
                    response = await self.client.post("https://api.tushare.pro", json={"api_name": name, "token": self.token, "params": params, "fields": fields})
                    if response.status_code >= 500 and attempt == 0:
                        await asyncio.sleep(.3)
                        continue
                    response.raise_for_status()
                    if len(response.content) > 4_000_000:
                        raise ValueError("数据响应过大")
                    result = response.json()
                    if type(result.get("code")) is not int or result["code"] != 0:
                        raise ValueError("数据源拒绝请求：请核对授权、积分或频次权限")
                    data = result.get("data") or {}
                    names, items = data.get("fields"), data.get("items")
                    if not isinstance(names, list) or not all(isinstance(k, str) for k in names) or len(set(names)) != len(names) or not isinstance(items, list):
                        raise ValueError("数据源结构异常")
                    if len(items) > 10000 or any(not isinstance(row, list) or len(row) != len(names) for row in items):
                        raise ValueError("数据源行结构异常")
                    return [dict(zip(names, row)) for row in items]
                except httpx.TransportError:
                    if attempt == 0:
                        await asyncio.sleep(.3)
                        continue
                    raise ValueError("数据源网络不可达，请稍后重试") from None
                except (httpx.HTTPStatusError, json.JSONDecodeError, AttributeError):
                    raise ValueError("数据源返回异常，请稍后重试") from None
                finally:
                    await asyncio.sleep(self.request_pause)
        raise ValueError("数据源暂不可用")

    async def calendar(self) -> None:
        cached = self.cache("calendar")
        if not self.due(cached, 21600):
            return
        now = self.clock()
        today = now.astimezone(CHINA).date()
        cached["lastAttemptAt"] = now.isoformat()
        try:
            rows = await self.api("trade_cal", {"exchange": "SSE", "start_date": (today-timedelta(days=40)).strftime("%Y%m%d"), "end_date": (today+timedelta(days=7)).strftime("%Y%m%d")}, "cal_date,is_open")
            days = {datetime.strptime(str(r["cal_date"]), "%Y%m%d").date().isoformat(): int(r["is_open"]) for r in rows}
            if today.isoformat() not in days:
                raise ValueError("交易日历不完整")
            cached.update({"days": days, "fetchedAt": now.isoformat(), "error": None})
        except (ValueError, KeyError, TypeError):
            cached["error"] = "交易日历未确认，暂停标记行情为有效"
        self.put("calendar", cached)

    async def cached_api(self, name: str, params: dict[str, Any], fields: str, seconds: int) -> tuple[list[dict[str, Any]], datetime]:
        key = f"{name}:{json.dumps(params,sort_keys=True)}:{fields}"
        entry = self.api_cache.get(key)
        if entry and (self.clock()-entry[0]).total_seconds() < seconds:
            return entry[1], entry[0]
        rows = await self.api(name, params, fields)
        self.api_cache[key] = self.clock(), rows
        if len(self.api_cache) > 1000:
            self.api_cache = {k: v for k, v in self.api_cache.items() if (self.clock()-v[0]).total_seconds() < 86400}
        return rows, self.api_cache[key][0]

    def expected(self, kind: str) -> tuple[date | None, bool]:
        now = self.clock().astimezone(CHINA)
        cal = self.cache("calendar")
        if not cal.get("fetchedAt") or cal.get("error") or not 0 <= (self.clock()-datetime.fromisoformat(cal["fetchedAt"])).total_seconds() <= 129600:
            return None, False
        days = cal.get("days", {})
        if now.date().isoformat() not in days:
            return None, False
        opened = bool(days[now.date().isoformat()])
        trading = opened and (time(9, 30) <= now.time() <= time(11, 30) or time(13) <= now.time() <= time(15))
        cutoff = time(21, 30) if kind == "nav" else time(16, 30)
        eligible = [date.fromisoformat(d) for d, flag in days.items() if flag == 1 and (d < now.date().isoformat() or (d == now.date().isoformat() and now.time() >= cutoff))]
        return (now.date() if kind == "realtime" and trading else max(eligible) if eligible else None), trading

    async def fetch_market(self, code: str, category: str) -> MarketSnapshot:
        now = self.clock()
        today = now.astimezone(CHINA).date()
        params = {"ts_code": code, "start_date": (today-timedelta(days=400)).strftime("%Y%m%d"), "end_date": today.strftime("%Y%m%d")}
        nav, nav_fetched = await self.cached_api("fund_nav", params, "ts_code,ann_date,nav_date,unit_nav,adj_nav", self.interval)
        nav = [r for r in nav if r.get("ts_code") == code]
        if not nav:
            raise ValueError("该代码没有返回基金净值，请核对完整数据代码与权限")
        check_prices(nav, "nav_date", "unit_nav")
        for row in nav:
            if datetime.strptime(str(row["nav_date"]), "%Y%m%d").date() > today or datetime.strptime(str(row["ann_date"]), "%Y%m%d").date() > today:
                raise ValueError("数据源日期异常")
        latest = max(nav, key=lambda r: str(r["nav_date"]))
        nav_day = datetime.strptime(str(latest["nav_date"]), "%Y%m%d").date()
        announced = datetime.strptime(str(latest["ann_date"]), "%Y%m%d").date()
        if announced < nav_day:
            raise ValueError("净值披露日期早于数据日期")
        snapshot = MarketSnapshot(providerCode=code, status="ready", reason="已完成校验", price=latest["unit_nav"], priceDate=nav_day,
            unitNav=latest["unit_nav"], navDate=nav_day, publishedOn=announced, fetchedAt=nav_fetched, navFetchedAt=nav_fetched, lastAttemptAt=now, **history_metrics(nav))
        if category == "etf":
            daily, daily_fetched = await self.cached_api("fund_daily", {**params, "start_date": (today-timedelta(days=30)).strftime("%Y%m%d")}, "ts_code,trade_date,close,pre_close,amount", self.interval)
            daily = [r for r in daily if r.get("ts_code") == code]
            if not daily:
                raise ValueError("缺少ETF收盘行情，不能以基金净值代替成交价")
            check_prices(daily, "trade_date", "close")
            quote = max(daily, key=lambda r: str(r["trade_date"]))
            check_change(quote["close"], quote["pre_close"])
            snapshot.kind = "close"
            snapshot.fetchedAt = daily_fetched
            snapshot.sourceUrl = "https://tushare.pro/document/2?doc_id=127"
            snapshot.price = Decimal(str(quote["close"]))
            snapshot.priceDate = datetime.strptime(str(quote["trade_date"]), "%Y%m%d").date()
            snapshot.turnover = Decimal(str(quote["amount"]))*1000 if quote.get("amount") is not None else None
            if snapshot.priceDate == nav_day and snapshot.unitNav is not None:
                snapshot.premium = round(float(snapshot.price/snapshot.unitNav-1)*100, 4)
            if self.realtime and self.expected("realtime")[1]:
                try:
                    rt = await self.api("rt_etf_k", {"ts_code": code, **({"topic": "HQ_FND_TICK"} if code.endswith(".SH") else {})}, "ts_code,close,pre_close,amount,trade_time")
                    quote = next(r for r in rt if r.get("ts_code") == code)
                    check_change(quote["close"], quote["pre_close"])
                    stamp = datetime.fromisoformat(str(quote["trade_time"]))
                    if stamp.tzinfo is None:
                        stamp = stamp.replace(tzinfo=CHINA)
                    snapshot.kind = "realtime"
                    snapshot.sourceUrl = "https://tushare.pro/document/2?doc_id=400"
                    snapshot.sourceTime = stamp
                    snapshot.fetchedAt = self.clock()
                    snapshot.priceDate = stamp.astimezone(CHINA).date()
                    snapshot.price = Decimal(str(quote["close"]))
                    snapshot.turnover = Decimal(str(quote["amount"])) if quote.get("amount") is not None else None
                    snapshot.premium = None  # Yesterday's NAV is not intraday IOPV.
                except (ValueError, KeyError, StopIteration):
                    snapshot.warnings.append("盘中行情未确认，当前仅显示收盘数据")
        try:
            basic, fee_fetched = await self.cached_api("fund_basic", {"ts_code": code, "market": "E" if category == "etf" else "O"}, "ts_code,m_fee,c_fee", 86400)
            row = next(r for r in basic if r.get("ts_code") == code)
            snapshot.managementFee = row.get("m_fee")
            snapshot.custodyFee = row.get("c_fee")
            snapshot.feesFetchedAt = fee_fetched
        except (ValueError, StopIteration):
            snapshot.warnings.append("管理费与托管费未自动核实，保留人工档案")
        return MarketSnapshot.model_validate(snapshot.model_dump())

    def checked(self, raw: dict[str, Any]) -> MarketSnapshot:
        snapshot = MarketSnapshot.model_validate(raw)
        expected, trading = self.expected(snapshot.kind)
        snapshot.expectedDate = expected
        if snapshot.status in {"blocked", "error", "pending"}:
            return snapshot
        stale = expected is None or snapshot.priceDate is None or snapshot.priceDate < expected or snapshot.priceDate > self.clock().astimezone(CHINA).date()
        stale |= not snapshot.fetchedAt or not 0 <= (self.clock()-snapshot.fetchedAt).total_seconds() <= max(1800, 2*self.interval)
        if snapshot.kind == "realtime" and trading:
            stale |= not snapshot.sourceTime or not 0 <= (self.clock()-snapshot.sourceTime).total_seconds() <= 180
        if snapshot.kind == "realtime":
            stale |= not snapshot.sourceTime or snapshot.sourceTime > self.clock()
        local = self.clock().astimezone(CHINA)
        if snapshot.kind == "close" and snapshot.priceDate == local.date() and local.time() < time(15):
            stale = True
        if self.realtime and trading and snapshot.kind == "close":
            stale = True
        if stale:
            snapshot.status, snapshot.reason = "stale", "行情过期、交易时间未确认或尚未披露，暂停自动候选"
        return snapshot

    async def channels(self) -> None:
        async def check(name: str, url: str) -> None:
            key = f"channel:{name}"
            if not self.due(self.cache(key), 21600):
                return
            status = "unknown"
            try:
                response = await self.client.head(url)
                status = "reachable" if 200 <= response.status_code < 300 else "needs_check"
            except httpx.HTTPError:
                status = "unavailable"
            self.put(key, {"name": name, "url": url, "status": status, "checkedAt": self.clock().isoformat(), "note": "仅检查官网可达性，不代表产品可购、资格或费率已核实"})
        await asyncio.gather(*(check(name, url) for name, url in CHANNELS))

    async def cycle(self) -> None:
        self.reload_config()
        if not self.enabled or self.lock.locked():
            return
        from .investment import InvestmentRecord
        async with self.lock:
            await self.channels()
            if self.token:
                await self.calendar()
            products: dict[str, str] = {}
            with self.factory() as db:
                for row in db.scalars(select(InvestmentRecord).where(InvestmentRecord.kind == "products")):
                    p = json.loads(row.payload)
                    code = provider_code(p)
                    if code and p.get("autoUpdate", True) and not p.get("demo") and p.get("category") in {"etf", "equity_fund", "bond_fund", "money_fund"}:
                        products[code] = p["category"]
            ordered = sorted(products, key=lambda c: self.cache(f"market:{c}").get("lastAttemptAt", ""))
            for code in ordered[:50]:
                previous = self.cache(f"market:{code}")
                interval = 60 if self.realtime and products[code] == "etf" and self.expected("realtime")[1] else self.interval
                if not self.due(previous, interval):
                    continue
                if not self.token:
                    result = MarketSnapshot(providerCode=code, status="blocked", reason="未配置TUSHARE_TOKEN，无法取得授权行情", lastAttemptAt=self.clock())
                else:
                    try:
                        result = await self.fetch_market(code, products[code])
                    except (ValueError, KeyError, TypeError, ArithmeticError):
                        result = MarketSnapshot.model_validate(previous) if previous else MarketSnapshot(providerCode=code)
                        result.status, result.reason = "error", "取数失败或数据校验未通过；保留旧值，暂停自动候选。请核对数据源权限与完整代码"
                        result.lastAttemptAt = self.clock()
                self.put(f"market:{code}", result.model_dump(mode="json"))
            self.last_cycle = self.clock().isoformat()
            self.service_error = None

    async def run(self) -> None:
        self.loop = asyncio.get_running_loop()
        while True:
            self.wake.clear()
            try:
                await self.cycle()
            except Exception:
                self.service_error = "自动同步任务异常，数据保留但不标记为最新"
            try:
                await asyncio.wait_for(self.wake.wait(), timeout=30)
            except TimeoutError:
                pass

    async def close(self) -> None:
        if self.owns_client:
            await self.client.aclose()

    def decorate(self, products: list[dict[str, Any]]) -> dict[str, Any]:
        for p in products:
            if p.get("demo") or not p.get("autoUpdate", True):
                continue
            code = provider_code(p)
            if not code:
                snapshot = MarketSnapshot(providerCode="", status="blocked", reason="请填写已确认的dataCode，例如510300.SH或基金完整数据代码；股票/直接债券暂不自动取数")
            elif not self.enabled or not self.token:
                previous = self.cache(f"market:{code}")
                snapshot = MarketSnapshot.model_validate(previous) if previous else MarketSnapshot(providerCode=code)
                snapshot.status, snapshot.reason = "blocked", "自动取数未启用" if not self.enabled else "行情数据源尚未授权"
            else:
                raw = self.cache(f"market:{code}")
                snapshot = self.checked(raw) if raw else MarketSnapshot(providerCode=code)
            p["market"] = snapshot.model_dump(mode="json")
            if self.service_error:
                snapshot.status, snapshot.reason = "error", self.service_error
                p["market"] = snapshot.model_dump(mode="json")
            if snapshot.status == "ready":
                p.update(annualReturn=snapshot.return1y, drawdown=snapshot.drawdown1y, returnPeriod=snapshot.period)
                for key in ["managementFee", "custodyFee"]:
                    if getattr(snapshot, key) is not None:
                        p[key] = getattr(snapshot, key)
                if p["category"] == "etf":
                    p.update(premium=snapshot.premium, turnover=str(snapshot.turnover) if snapshot.turnover is not None else None)
        channels = []
        for name, url in CHANNELS:
            item = self.cache(f"channel:{name}") or {"name": name, "url": url, "status": "pending", "checkedAt": None}
            if item.get("checkedAt") and self.due(item, 86400):
                item["status"] = "stale"
            channels.append(item)
        return {"enabled": self.enabled, "configured": bool(self.token), "realtimeEnabled": self.realtime, "intervalSeconds": self.interval,
                "lastCycleAt": self.last_cycle, "serviceError": self.service_error, "channels": channels,
                "accountSync": "尚未连接券商/基金账户，成交与现金流需本人对账；行情刷新不改写实际收益账本"}


def live_valuation(data: dict[str, Any]) -> dict[str, Any]:
    positions = data["positions"]
    products = {p["code"]: p for p in data["products"]}
    value = Decimal(str(data["account"]["cash"]))
    missing, dates = [], set()
    for position in positions:
        snapshot = products.get(position["code"], {}).get("market") or {}
        if snapshot.get("status") != "ready" or snapshot.get("price") is None:
            missing.append(position["code"])
        else:
            value += Decimal(str(position["units"]))*Decimal(str(snapshot["price"]))
            dates.add(snapshot.get("priceDate"))
    return {"ready": bool(positions) and not missing, "value": float(value) if positions and not missing else None,
            "missingCodes": missing, "priceDates": sorted(d for d in dates if d), "cashAsOf": data["account"]["updatedOn"],
            "message": "按最新可用行情与已录份额、现金估算；未连接实际账户，不含未录成交/分红，不写入真实TWR或XIRR。"}
