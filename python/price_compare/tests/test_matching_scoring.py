from __future__ import annotations

import pytest

from price_compare.fixtures import demo_offers
from price_compare.matching import match_offer, normalized_request
from price_compare.schemas import NormalizedOffer, SearchRequest
from price_compare.scoring import rank_offers
from price_compare.importers import parse_import
from price_compare.schemas import ImportRequest


@pytest.mark.parametrize("scenario", ["phone", "laptop", "mixed"])
def test_all_demo_scenarios_have_sources_and_stable_shape(scenario: str) -> None:
    request = SearchRequest(query="demo", platforms=["demo"], demoScenario=scenario)
    offers = demo_offers(request)
    assert offers
    assert all(item.source_mode == "demo" and item.external_id for item in offers)


@pytest.mark.parametrize("condition", ["new", "used", "refurbished"])
def test_condition_mismatch_is_ineligible(condition: str) -> None:
    request = SearchRequest(query="A", model="A", condition=condition)
    offer = NormalizedOffer(platform="demo", externalId="1", title="A", url="https://example.com/a", model="A", condition="used", itemPrice=10, shippingFee=0, taxFee=0, serviceFee=0, couponDiscount=0, subsidy=0)
    assert not match_offer(request, offer).eligible if condition != "used" else match_offer(request, offer).eligible


@pytest.mark.parametrize("budget,eligible", [(100, True), (9, False), (None, True)])
def test_budget_filter(budget: int | None, eligible: bool) -> None:
    request = SearchRequest(query="A", model="A", condition="new", budgetMax=budget)
    offer = NormalizedOffer(platform="demo", externalId="1", title="A", url="https://example.com/a", model="A", condition="new", itemPrice=10, shippingFee=0, taxFee=0, serviceFee=0, couponDiscount=0, subsidy=0)
    assert match_offer(request, offer).eligible is eligible


def test_normalized_query_extracts_phone_storage() -> None:
    request = normalized_request(SearchRequest(query="iPhone 16 256GB"))
    assert request.brand == "Apple"
    assert request.model == "iPhone 16"
    assert request.specs["storage"] == "256GB"


def test_rank_only_exact_and_same_currency_are_recommendable() -> None:
    request = SearchRequest(query="A", model="A", condition="new", currency="CNY", platforms=["demo"])
    offers = [
        NormalizedOffer(platform="demo", externalId="1", title="A", url="https://example.com/1", model="A", condition="new", itemPrice=10, shippingFee=0, taxFee=0, serviceFee=0, couponDiscount=0, subsidy=0, currency="CNY"),
        NormalizedOffer(platform="demo", externalId="2", title="A", url="https://example.com/2", model="A", condition="new", itemPrice=9, shippingFee=0, taxFee=0, serviceFee=0, couponDiscount=0, subsidy=0, currency="USD"),
    ]
    rows = rank_offers(request, offers)
    assert rows[0].eligible and not rows[1].eligible
    assert rows[0].scores["total"] is not None


def test_unknown_social_metrics_are_not_zero() -> None:
    request = SearchRequest(query="A", model="A", condition="new")
    offer = NormalizedOffer(platform="demo", externalId="1", title="A", url="https://example.com/1", model="A", condition="new", itemPrice=10, shippingFee=0, taxFee=0, serviceFee=0)
    row = rank_offers(request, [offer])[0]
    assert row.likes is None and row.scores["heat"] is None


@pytest.mark.parametrize("storage", ["128GB", "512GB", "1TB"])
def test_different_storage_never_exact(storage: str) -> None:
    request = SearchRequest(query="A", model="A", specs={"storage": "256GB"})
    offer = NormalizedOffer(platform="demo", externalId="1", title="A", url="https://example.com/1", model="A", specs={"storage": storage}, condition="new")
    assert match_offer(request, offer).match_level == "near"


def test_csv_import_parses_specs_and_preserves_blank_fee() -> None:
    csv = 'platform,externalId,title,url,model,condition,itemPrice,shippingFee,specs\nmanual,x,A,https://example.com/a,A,new,20,,"{""storage"":""256GB""}"\n'
    rows = parse_import(ImportRequest(format="csv", data=csv))
    assert rows[0].specs == {"storage": "256GB"}
    assert rows[0].shipping_fee is None


def test_empty_import_rejected() -> None:
    with pytest.raises(ValueError):
        parse_import(ImportRequest(format="json", data="[]"))


def test_stable_rank_and_top_three() -> None:
    request = SearchRequest(query="iPhone 16", model="iPhone 16", brand="Apple", condition="new", specs={"storage": "256GB"}, platforms=["demo"])
    first = rank_offers(request, demo_offers(request))
    second = rank_offers(request, demo_offers(request))
    assert [row.external_id for row in first] == [row.external_id for row in second]
    assert len([row for row in first if row.rank]) == 3
