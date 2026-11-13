from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from price_compare.config import Settings
from price_compare.main import create_app
from price_compare.matching import match_offer
from price_compare.schemas import NormalizedOffer, SearchRequest


def client(tmp_path: Path) -> TestClient:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'compare.db'}", internal_token="local-token"))
    return TestClient(app)


def headers() -> dict[str, str]:
    return {"Authorization": "Bearer local-token", "X-User-Id": "7", "X-Project-Id": "99"}


def test_requires_internal_scope(tmp_path: Path) -> None:
    with client(tmp_path) as api:
        response = api.get("/providers")
        assert response.status_code == 401


def test_demo_search_returns_exact_top_three_and_is_scoped(tmp_path: Path) -> None:
    with client(tmp_path) as api:
        response = api.post("/search", headers=headers(), json={"query": "iPhone 16 256GB", "brand": "Apple", "model": "iPhone 16", "specs": {"storage": "256GB"}, "condition": "new", "budgetMax": 5000, "platforms": ["demo"], "demoScenario": "phone"})
        assert response.status_code == 200
        payload = response.json()
        assert payload["summary"]["exactMatchCount"] >= 3
        assert len(payload["recommendations"]) == 3
        assert all(item["matchLevel"] == "exact" for item in payload["recommendations"])
        assert api.get("/runs", headers=headers()).status_code == 200
        assert api.get("/runs", headers={**headers(), "X-User-Id": "8"}).json() == []


def test_missing_shipping_is_incomplete_not_zero() -> None:
    request = SearchRequest(query="phone", model="A", condition="new")
    offer = NormalizedOffer(platform="x", externalId="1", title="A", url="https://example.com/a", model="A", condition="new", itemPrice=10, taxFee=0, serviceFee=0)
    matched = match_offer(request, offer)
    assert matched.landed_price is None
    assert len(matched.risks) >= 2


def test_import_and_favorite_ownership(tmp_path: Path) -> None:
    with client(tmp_path) as api:
        offer = {"platform": "manual", "externalId": "x1", "title": "手工商品", "url": "https://example.com/x1", "model": "X", "condition": "new", "itemPrice": 100, "shippingFee": 0, "taxFee": 0, "serviceFee": 0}
        imported = api.post("/imports", headers=headers(), json={"format": "manual", "data": offer})
        assert imported.status_code == 200
        assert imported.json()["count"] == 1
        search = api.post("/search", headers=headers(), json={"query": "iPhone", "platforms": ["demo"]}).json()
        offer_id = search["offers"][0]["id"]
        favorite = api.post("/favorites", headers=headers(), json={"offerId": offer_id, "note": "关注"})
        assert favorite.status_code == 200
        assert api.get("/favorites", headers={**headers(), "X-Project-Id": "100"}).json() == []
