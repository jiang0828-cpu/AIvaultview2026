import asyncio
import json
from contextlib import suppress
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from price_compare.config import Settings
from price_compare.investment import InvestmentRecord, Product, demo_data, product_issues
from price_compare.investment_data import CHANNELS, InvestmentSync, MarketSnapshot, check_change, check_prices, history_metrics, live_valuation, provider_code
from price_compare.main import create_app
from price_compare.models import make_session

NOW = datetime(2026, 11, 13, 14, tzinfo=timezone.utc)


def envelope(rows):
    fields = list(rows[0]) if rows else []
    return {"code": 0, "data": {"fields": fields, "items": [[r[k] for k in fields] for r in rows]}}


def nav_rows(code="510300.SH"):
    days = [NOW.date()-timedelta(days=i) for i in reversed(range(401)) if (NOW.date()-timedelta(days=i)).weekday() < 5]
    return [{"ts_code": code, "ann_date": d.strftime("%Y%m%d"), "nav_date": d.strftime("%Y%m%d"), "unit_nav": 1, "adj_nav": 1+i/1000} for i, d in enumerate(days)]


@pytest.fixture
def service(tmp_path):
    calls = []
    def transport(request):
        if request.method == "HEAD":
            calls.append(("channel", str(request.url)))
            return httpx.Response(200)
        payload = json.loads(request.content)
        name = payload["api_name"]
        calls.append((name, payload["params"]))
        code = payload["params"].get("ts_code", "510300.SH")
        if name == "trade_cal":
            rows = [{"cal_date": (NOW.date()+timedelta(days=i)).strftime("%Y%m%d"), "is_open": int((NOW.date()+timedelta(days=i)).weekday() < 5)} for i in range(-40, 8)]
        elif name == "fund_nav":
            rows = nav_rows(code)
        elif name == "fund_daily":
            rows = [{"ts_code": code, "trade_date": "20261113", "close": 1.001, "pre_close": 1, "amount": 100}]
        elif name == "fund_basic":
            rows = [{"ts_code": code, "m_fee": .15, "c_fee": .05}]
        elif name == "rt_etf_k":
            rows = [{"ts_code": code, "trade_time": "2026-11-13T10:00:00+08:00", "close": 1.002, "pre_close": 1, "amount": 1234}]
        else:
            raise AssertionError(name)
        return httpx.Response(200, json=envelope(rows))
    factory, engine = make_session(f"sqlite:///{tmp_path}/data.db")
    client = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    config = Settings(database_url=f"sqlite:///{tmp_path}/data.db", investment_auto_update=True, tushare_token="test-only-secret")
    sync = InvestmentSync(factory, config, client=client, clock=lambda: NOW, request_pause=0)
    yield sync, calls
    asyncio.run(client.aclose())
    engine.dispose()


def calendar(sync):
    asyncio.run(sync.calendar())


def snapshot(**updates):
    data = dict(providerCode="510300.SH", status="ready", reason="校验完成", kind="close", price="1", priceDate="2026-11-13", fetchedAt=NOW)
    data.update(updates)
    return MarketSnapshot(**data)


@pytest.mark.parametrize("product,expected", [({"code": "510300", "category": "etf"}, "510300.SH"),
    ({"code": "159919", "category": "etf"}, "159919.SZ"), ({"code": "000001", "category": "equity_fund"}, None),
    ({"code": "000001", "category": "equity_fund", "dataCode": "000001.OF"}, "000001.OF"),
    ({"code": "DEMO01", "category": "etf"}, None), ({"code": "510300", "category": "stock", "dataCode": "510300.SH"}, None)])
def test_market_mapping_never_guesses_off_exchange_or_stock(product, expected):
    assert provider_code(product) == expected


def test_product_data_code_must_identify_same_instrument():
    p = demo_data()["products"][0]
    p.update(code="510300", demo=False, dataCode="510500.SH")
    with pytest.raises(ValidationError, match="一致"):
        Product.model_validate(p)


def test_adjusted_history_does_not_use_raw_unit_nav():
    data = history_metrics(nav_rows())
    assert data["return1y"] > 0 and data["drawdown1y"] == 0
    assert "复权净值" in data["period"]
    assert history_metrics([{**r, "adj_nav": None} for r in nav_rows()]) == {}
    assert history_metrics(nav_rows()[-100:]) == {}


def test_conflicting_nonfinite_or_zero_prices_rejected():
    for rows in [[{"day": "1", "price": 0}], [{"day": "1", "price": "NaN"}], [{"day": "1", "price": 1}, {"day": "1", "price": 2}]]:
        with pytest.raises(ValueError):
            check_prices(rows, "day", "price")


def test_extreme_change_is_quarantined_for_manual_review():
    for price, previous in [(2, 1), (1, 0), ("NaN", 1)]:
        with pytest.raises(ValueError):
            check_change(price, previous)


def test_credentials_reload_resets_backoff_without_changing_source_time(service, tmp_path):
    sync, _ = service
    sync.env_file = tmp_path/"local.env"
    sync.put("market:510300.SH", snapshot(lastAttemptAt=NOW).model_dump(mode="json"))
    sync.env_file.write_text("TUSHARE_TOKEN=reloaded-test-token\nINVESTMENT_UPDATE_INTERVAL_SECONDS=600\nINVESTMENT_REALTIME_ENABLED=true\n", encoding="utf8")
    sync.reload_config()
    assert sync.token == "reloaded-test-token" and sync.interval == 600 and sync.realtime
    assert sync.cache("market:510300.SH")["fetchedAt"] == NOW.isoformat().replace("+00:00", "Z")
    assert sync.cache("market:510300.SH")["lastAttemptAt"] is None


def test_background_job_runs_without_page_and_wakes_from_thread(service):
    sync, _ = service
    async def verify():
        task = asyncio.create_task(sync.run())
        async def until_cycle():
            while sync.last_cycle is None:
                await asyncio.sleep(.01)
        try:
            await asyncio.wait_for(until_cycle(), 2)
            sync.clock = lambda: NOW+timedelta(seconds=1)
            await asyncio.to_thread(sync.request_refresh)
            async def until_wake():
                while sync.last_cycle == NOW.isoformat():
                    await asyncio.sleep(.01)
            await asyncio.wait_for(until_wake(), 2)
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
    asyncio.run(verify())


def test_official_mapping_units_source_and_history(service):
    sync, calls = service
    calendar(sync)
    value = asyncio.run(sync.fetch_market("510300.SH", "etf"))
    assert value.price == Decimal("1.001") and value.turnover == 100000
    assert value.premium == pytest.approx(.1)
    assert value.return1y is not None and value.managementFee == .15
    assert value.sourceTime is None and value.kind == "close"
    assert sync.checked(value.model_dump(mode="json")).status == "ready"
    assert {name for name, _ in calls} >= {"fund_nav", "fund_daily", "fund_basic", "trade_cal"}


def test_fetch_cache_avoids_repeated_historical_requests(service):
    sync, calls = service
    first = asyncio.run(sync.fetch_market("510300.SH", "etf"))
    initial = len(calls)
    sync.clock = lambda: NOW+timedelta(seconds=60)
    second = asyncio.run(sync.fetch_market("510300.SH", "etf"))
    assert len(calls) == initial
    assert second.fetchedAt == first.fetchedAt and second.feesFetchedAt == first.feesFetchedAt


def test_holiday_uses_last_open_day_not_wall_clock_date(service):
    sync, _ = service
    calendar(sync)
    cal = sync.cache("calendar")
    cal["days"]["2026-11-16"] = 0
    cal["fetchedAt"] = "2026-11-16T14:00:00+00:00"
    sync.put("calendar", cal)
    sync.clock = lambda: datetime(2026, 11, 16, 14, tzinfo=timezone.utc)
    assert sync.expected("close")[0] == date(2026, 11, 13)


@pytest.mark.parametrize("changes", [{"priceDate": "2026-11-12"}, {"priceDate": "2026-11-14"}, {"fetchedAt": NOW-timedelta(hours=1)}, {"fetchedAt": NOW+timedelta(minutes=1)}])
def test_fresh_fetch_does_not_hide_stale_data(service, changes):
    sync, _ = service
    calendar(sync)
    assert sync.checked(snapshot(**changes).model_dump(mode="json")).status == "stale"


def test_calendar_missing_or_failure_blocks_freshness(service):
    sync, _ = service
    assert sync.checked(snapshot().model_dump(mode="json")).status == "stale"
    calendar(sync)
    sync.put("calendar", {**sync.cache("calendar"), "error": "unavailable"})
    assert sync.checked(snapshot().model_dump(mode="json")).status == "stale"


def test_realtime_requires_source_clock_and_does_not_mix_previous_nav(service):
    sync, _ = service
    sync.clock = lambda: datetime(2026, 11, 13, 2, tzinfo=timezone.utc)
    calendar(sync)
    sync.realtime = True
    value = asyncio.run(sync.fetch_market("510300.SH", "etf"))
    assert value.kind == "realtime" and value.premium is None and value.turnover == 1234
    assert sync.checked(value.model_dump(mode="json")).status == "ready"
    raw = value.model_dump(mode="json")
    raw["sourceTime"] = None
    assert sync.checked(raw).status == "stale"
    raw["sourceTime"] = "2026-11-13T09:50:00+08:00"
    assert sync.checked(raw).status == "stale"
    raw["sourceTime"] = "2026-11-13T11:00:00+08:00"
    assert sync.checked(raw).status == "stale"


def test_failure_keeps_last_good_price_without_renewing_timestamp(service):
    sync, _ = service
    calendar(sync)
    sync.put("market:510300.SH", snapshot(fetchedAt=NOW-timedelta(hours=1)).model_dump(mode="json"))
    with sync.factory() as db:
        db.add(InvestmentRecord(user_id=1, project_id=255, kind="products", key="510300", payload=json.dumps({"code": "510300", "category": "etf"})))
        db.commit()
    async def failed(*_args):
        raise ValueError("private provider message")
    sync.fetch_market = failed
    asyncio.run(sync.cycle())
    value = sync.cache("market:510300.SH")
    assert value["status"] == "error" and value["price"] == "1"
    assert datetime.fromisoformat(value["fetchedAt"]) == NOW-timedelta(hours=1)
    assert "private provider message" not in json.dumps(value)


def test_permission_errors_never_echo_token_or_use_http(service):
    sync, _ = service
    def denied(request):
        assert str(request.url) == "https://api.tushare.pro"
        return httpx.Response(200, json={"code": 2002, "msg": "test-only-secret"})
    asyncio.run(sync.client.aclose())
    sync.client = httpx.AsyncClient(transport=httpx.MockTransport(denied))
    with pytest.raises(ValueError) as error:
        asyncio.run(sync.api("fund_nav", {}, ""))
    assert "test-only-secret" not in str(error.value)
    asyncio.run(sync.client.aclose())


def test_one_product_failure_does_not_stop_other_products(service):
    sync, _ = service
    calendar(sync)
    with sync.factory() as db:
        for code in ["510300", "510500"]:
            db.add(InvestmentRecord(user_id=1, project_id=255, kind="products", key=code, payload=json.dumps({"code": code, "category": "etf"})))
        db.commit()
    async def fetch(code, category):
        if code == "510300.SH":
            raise ValueError("one failure")
        return snapshot(providerCode=code)
    sync.fetch_market = fetch
    asyncio.run(sync.cycle())
    assert sync.cache("market:510300.SH")["status"] == "error"
    assert sync.cache("market:510500.SH")["status"] == "ready"


def test_channels_only_check_fixed_official_urls_and_expire(service):
    sync, calls = service
    asyncio.run(sync.channels())
    assert {url for name, url in calls if name == "channel"} == {url for _, url in CHANNELS}
    assert all(row["status"] == "reachable" for row in sync.decorate([])["channels"])
    sync.clock = lambda: NOW+timedelta(days=2)
    assert all(row["status"] == "stale" for row in sync.decorate([])["channels"])


def test_no_credentials_or_service_failure_blocks_candidate_but_preserves_facts(service):
    sync, _ = service
    calendar(sync)
    sync.put("market:510300.SH", snapshot(return1y=5, drawdown1y=10).model_dump(mode="json"))
    p = demo_data()["products"][0]
    p.update(code="510300", demo=False)
    original_day = p["asOf"]
    sync.token = ""
    result = sync.decorate([p])
    assert not result["configured"] and p["market"]["status"] == "blocked" and p["market"]["price"] == "1"
    assert p["asOf"] == original_day
    assert any("行情" in reason for reason in product_issues(Product.model_validate(p)))
    sync.token = "test-only-secret"
    sync.service_error = "job failed"
    sync.decorate([p])
    assert p["market"]["status"] == "error"


def test_live_valuation_never_changes_reconciled_records():
    data: dict[str, Any] = {"account": {"cash": "100", "updatedOn": "2026-11-13"}, "positions": [{"code": "510300", "units": "200"}],
            "products": [{"code": "510300", "market": snapshot(price="1.2").model_dump(mode="json")}], "valuations": [{"value": "999"}]}
    before = json.dumps(data)
    result = live_valuation(data)
    assert result["value"] == 340 and json.dumps(data) == before
    data["products"][0]["market"]["status"] = "stale"
    assert live_valuation(data)["value"] is None


def test_refresh_scoped_and_managed_market_import_rejected(tmp_path):
    config = Settings(database_url=f"sqlite:///{tmp_path}/api.db", internal_token="test-internal", investment_auto_update=False)
    app = create_app(config)
    with TestClient(app) as client:
        assert client.post("/investment/refresh").status_code == 401
        headers = {"Authorization": "Bearer test-internal", "X-User-Id": "1", "X-Project-Id": "255"}
        response = client.post("/investment/refresh", headers=headers)
        assert response.status_code == 202 and response.json()["queued"] is False
        p = demo_data()["products"][0]
        p.update(code="510300", demo=False, market=snapshot().model_dump(mode="json"))
        response = client.post("/investment/import", headers=headers, json={"kind": "products", "data": [p]})
        assert response.status_code == 400
