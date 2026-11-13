from decimal import Decimal
from datetime import date, datetime, timedelta, timezone

import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from pathlib import Path

from price_compare.fixtures import demo_offers
from price_compare.matching import match_offer
from price_compare.schemas import NormalizedOffer, SearchRequest
from price_compare.scoring import rank_offers
from price_compare.importers import parse_import
from price_compare.schemas import ImportRequest
from price_compare.config import Settings
from price_compare.main import create_app


def offer(**overrides: object) -> NormalizedOffer:
    return NormalizedOffer.model_validate({
        "platform": "jd", "externalId": "oats-1", "title": "原味燕麦片", "url": "https://item.jd.com/123.html",
        "brand": "示例粮坊", "model": "原味燕麦片", "category": "food", "packCount": 2,
        "netWeight": 500, "unit": "g", "condition": "new", "specs": {"variant": "原味"},
        "itemPrice": 30, "shippingFee": 0, "taxFee": 0, "serviceFee": 0, "couponDiscount": 0, "subsidy": 0,
        **overrides,
    })


def request(**overrides: object) -> SearchRequest:
    return SearchRequest.model_validate({"query": "燕麦片", "model": "原味燕麦片", "brand": "示例粮坊", "category": "food",
                                         "packCount": 2, "netWeight": 500, "unit": "g", "condition": "new",
                                         "specs": {"variant": "原味"}, **overrides})


@pytest.mark.parametrize(("expected", "actual"), [("有效氯3.5%", "有效氯35%"), ("1+1", "11"), ("1:10", "110")])
def test_formula_punctuation_is_semantic(expected: str, actual: str) -> None:
    result = match_offer(request(specs={"variant": expected}), offer(specs={"variant": actual}))
    assert result.match_level != "exact"
    assert not result.eligible


@pytest.mark.parametrize("currency", ["12!", "$$$", "CN1", "", "人民币", 123, None])
def test_invalid_currency_rejected(currency: object) -> None:
    with pytest.raises(ValidationError):
        request(currency=currency)
    with pytest.raises(ValidationError):
        offer(currency=currency)


def test_currency_is_case_normalized() -> None:
    assert request(currency="cny").currency == "CNY"
    assert offer(currency="usd").currency == "USD"


def test_unit_price_uses_total_net_contents() -> None:
    row = offer()
    assert row.total_quantity == Decimal("1")
    assert row.unit_price == Decimal("30")
    assert row.comparison_unit == "kg"


def test_metric_units_can_match_when_per_pack_contents_are_equivalent() -> None:
    row = match_offer(request(), offer(netWeight="0.5", unit="kg"))
    assert row.match_level == "exact" and row.eligible


@pytest.mark.parametrize("change", [{"packCount": 4}, {"netWeight": 250}, {"unit": "ml"}, {"packCount": None}, {"netWeight": None}])
def test_different_or_missing_packaging_never_enters_strict_recommendations(change: dict[str, object]) -> None:
    row = match_offer(request(), offer(**change))
    assert row.match_level == "near" and not row.eligible


def test_missing_requested_quantity_cannot_be_assumed() -> None:
    assert not match_offer(request(netWeight=None), offer()).eligible


@pytest.mark.parametrize("change", [{"brand": None}, {"specs": {}}, {"specs": {"variant": ""}}])
def test_daily_missing_identity_is_reference_only(change: dict[str, object]) -> None:
    assert not match_offer(request(**change), offer()).eligible


def test_near_expiry_is_visible_in_risks() -> None:
    row = match_offer(request(), offer(expiresOn=(date.today() + timedelta(days=5)).isoformat()))
    assert any("保质期不足" in risk for risk in row.risks)


def test_food_expiring_before_arrival_is_ineligible() -> None:
    row = match_offer(request(), offer(expiresOn=(date.today() + timedelta(days=1)).isoformat(), deliveryDays=7))
    assert not row.eligible
    assert any("送达时已超过保质期" in risk for risk in row.risks)


@pytest.mark.parametrize("policy", ["无官方保修", "no official warranty", "不支持官方保修"])
def test_negated_policy_cannot_satisfy_required_condition(policy: str) -> None:
    required = "official warranty" if policy.startswith("no ") else "官方保修"
    row = match_offer(request(requiredConditions=[required]), offer(returnPolicy=policy))
    assert not row.eligible


def test_required_condition_needs_exact_structured_evidence() -> None:
    row = match_offer(request(requiredConditions=["官方保修"]), offer(specs={"variant": "原味", "warranty": "官方保修"}))
    assert row.eligible


def test_unknown_shipping_keeps_unit_price_unknown() -> None:
    row = offer(shippingFee=None)
    assert row.unit_price is None and row.landed_price is None


def test_imported_unit_price_cannot_override_calculated_value() -> None:
    assert offer(unitPrice="0.01", totalQuantity=100, comparisonUnit="piece").unit_price == Decimal("30")


@pytest.mark.parametrize("field,value", [("packCount", 0), ("netWeight", -1), ("unit", "bottle")])
def test_invalid_daily_quantity_is_rejected(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        offer(**{field: value})


@pytest.mark.parametrize("scenario,brand,model,weight,unit,count,variant", [
    ("food", "示例粮坊", "原味燕麦片", 500, "g", 2, "原味"),
    ("drink", "示例牧场", "全脂纯牛奶", 250, "ml", 12, "全脂"),
    ("household", "示例净护", "无香洗衣液", 2, "l", 2, "无香标准浓度"),
])
def test_daily_scenarios_have_three_strict_recommendations_with_unit_price(scenario: str, brand: str, model: str, weight: int, unit: str, count: int, variant: str) -> None:
    req = request(category=scenario, demoScenario=scenario, brand=brand, model=model, netWeight=weight, unit=unit,
                  packCount=count, specs={"variant": variant}, platforms=["demo"])
    rows = rank_offers(req, demo_offers(req))
    selected = [row for row in rows if row.rank]
    assert len(selected) == 3
    assert all(row.eligible and row.unit_price is not None and row.pack_count == count for row in selected)
    assert all(any("单位价" in reason for reason in row.reasons) for row in selected)
    assert all(row.source_mode == "demo" for row in rows)


def test_daily_sort_does_not_reward_cheaper_different_pack_or_variant() -> None:
    rows = rank_offers(request(), [offer(itemPrice=30), offer(externalId="wrong-pack", packCount=1, itemPrice=10),
                                  offer(externalId="wrong-variant", itemPrice=5, specs={"variant": "加糖"})])
    assert [row.external_id for row in rows if row.rank] == ["oats-1"]


def test_expired_food_is_not_recommended() -> None:
    row = match_offer(request(), offer(expiresOn=(date.today() - timedelta(days=1)).isoformat()))
    assert not row.eligible
    assert any("保质期" in risk for risk in row.risks)


def test_food_expiry_unknown_is_visible_and_today_is_still_valid() -> None:
    assert any("保质期未确认" in risk for risk in match_offer(request(), offer()).risks)
    assert match_offer(request(), offer(expiresOn=date.today().isoformat())).eligible


def test_stale_quote_reduces_confidence_without_inventing_quality_data() -> None:
    current = offer(reviewCount=None, positiveRate=None)
    stale = offer(externalId="old", sourceFetchedAt=(datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
                  reviewCount=None, positiveRate=None)
    rows = rank_offers(request(), [current, stale])
    by_id = {row.external_id: row for row in rows}
    assert by_id["old"].data_completeness < by_id["oats-1"].data_completeness
    assert by_id["old"].scores["quality"] is None
    assert any("未更新" in risk for risk in by_id["old"].risks)


def test_untrusted_prior_rank_is_cleared_even_for_ineligible_offer() -> None:
    rows = rank_offers(request(), [offer(), offer(externalId="wrong", packCount=1, rank=1)])
    assert next(row for row in rows if row.external_id == "wrong").rank is None


@pytest.mark.parametrize("url", ["https://jd.com.evil.example/a", "http://item.jd.com/1.html", "https://example.com/a", "https://item.jd.com:8443/a"])
def test_platform_import_cannot_mislabel_external_link(url: str) -> None:
    with pytest.raises(ValueError):
        offer(url=url)


def test_import_forces_manual_source_and_removes_derived_rank() -> None:
    payload = offer(sourceMode="demo", rank=1, eligible=True).model_dump(mode="json", by_alias=True)
    imported = parse_import(ImportRequest(format="json", data=[payload]))[0]
    assert imported.source_mode == "manual"
    assert imported.rank is None and not imported.eligible and imported.scores == {}


def test_expiry_and_unit_prices_round_trip_in_live_run(tmp_path: Path) -> None:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'daily.db'}", internal_token="daily-token"))
    headers = {"Authorization": "Bearer daily-token", "X-User-Id": "1", "X-Project-Id": "1"}
    payload = offer(expiresOn=(date.today() + timedelta(days=30)).isoformat()).model_dump(mode="json", by_alias=True)
    with TestClient(app) as api:
        assert api.post("/imports", headers=headers, json={"format": "manual", "data": payload}).status_code == 200
        req = request(mode="live", platforms=["jd"]).model_dump(mode="json", by_alias=True)
        result = api.post("/search", headers=headers, json=req)
        assert result.status_code == 200
        run = result.json()
        assert len(run["offers"]) == 1
        assert run["recommendations"][0]["unitPrice"] == 30
        assert isinstance(run["recommendations"][0]["expiresOn"], str)
        history = api.get(f"/runs/{run['runId']}", headers=headers)
        assert history.json()["recommendations"][0]["unitPrice"] == 30
        assert history.json()["summary"]["providerStatus"]["jd"]["platform"] == "jd"
        assert history.json()["summary"]["providerStatus"] == run["summary"]["providerStatus"]
        assert "_providerStatus" not in history.json()["request"]
        listing = api.get("/runs", headers=headers).json()
        assert listing[0]["mode"] == "live"


def test_zero_confirmed_price_is_not_mistaken_for_unknown() -> None:
    ranked = rank_offers(request(), [offer(itemPrice=0), offer(externalId="paid", itemPrice=30)])
    assert ranked[0].unit_price == 0
    assert ranked[0].scores["price"] == 100
    assert ranked[1].scores["price"] == 0


def test_unknown_condition_request_never_recommends_used_consumables() -> None:
    assert not match_offer(request(condition="unknown"), offer(condition="used")).eligible


def test_live_mode_cannot_inject_demo_fixtures(tmp_path: Path) -> None:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'no-demo.db'}", internal_token="daily-token"))
    headers = {"Authorization": "Bearer daily-token", "X-User-Id": "1", "X-Project-Id": "1"}
    with TestClient(app) as api:
        result = api.post("/search", headers=headers, json={"query": "iPhone", "mode": "live", "platforms": ["demo"]})
        assert result.status_code == 200
        assert result.json()["offers"] == []


def test_candidate_limit_never_hides_matching_imports(tmp_path: Path) -> None:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'limit.db'}", internal_token="daily-token", max_results=2))
    headers = {"Authorization": "Bearer daily-token", "X-User-Id": "1", "X-Project-Id": "1"}
    irrelevant = [offer(model="其他商品", externalId=f"unrelated-{index}").model_dump(mode="json", by_alias=True) for index in range(4)]
    relevant = offer(externalId="wanted").model_dump(mode="json", by_alias=True)
    with TestClient(app) as api:
        imported = api.post("/imports", headers=headers, json={"format": "json", "data": [*irrelevant, relevant]})
        assert imported.status_code == 200
        req = request(mode="live", platforms=["jd"]).model_dump(mode="json", by_alias=True)
        result = api.post("/search", headers=headers, json=req).json()
        assert result["recommendations"][0]["externalId"] == "wanted"
        assert len(result["offers"]) == 2
