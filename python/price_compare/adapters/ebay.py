from __future__ import annotations

import base64
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import httpx
import asyncio

from ..config import Settings
from ..schemas import NormalizedOffer, SearchRequest


class EbayAdapter:
    platform = "ebay"

    def __init__(self, settings: Settings):
        self.settings = settings

    def capabilities(self) -> dict[str, Any]:
        enabled = bool(self.settings.ebay_client_id and self.settings.ebay_client_secret)
        return {"platform": self.platform, "name": "eBay Browse API", "status": "available" if enabled else "unavailable",
                "reason": "已配置官方 OAuth" if enabled else "未配置官方 OAuth 授权", "fallback": "manual_import" if not enabled else None,
                "automaticSearch": enabled}

    async def _token(self, client: httpx.AsyncClient) -> str:
        raw = f"{self.settings.ebay_client_id}:{self.settings.ebay_client_secret}".encode()
        response = await client.post("https://api.ebay.com/identity/v1/oauth2/token", headers={"Authorization": f"Basic {base64.b64encode(raw).decode()}", "Content-Type": "application/x-www-form-urlencoded"}, content="grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope")
        response.raise_for_status()
        return str(response.json()["access_token"])

    async def search(self, request: SearchRequest) -> list[NormalizedOffer]:
        if not self.capabilities()["automaticSearch"]:
            return []
        timeout = httpx.Timeout(10, connect=5)
        async with httpx.AsyncClient(timeout=timeout) as client:
            token = await self._token(client)
            response: httpx.Response | None = None
            for attempt in range(2):
                response = await client.get("https://api.ebay.com/buy/browse/v1/item_summary/search", params={"q": request.query, "limit": 20}, headers={"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": self.settings.ebay_marketplace})
                if response.status_code not in {429, 500, 502, 503, 504} or attempt:
                    break
                await asyncio.sleep(0.25)
            assert response is not None
            response.raise_for_status()
            rows = response.json().get("itemSummaries", [])
            return [self._normalize(row) for row in rows]

    def _normalize(self, row: dict[str, Any]) -> NormalizedOffer:
        price = row.get("price") or {}
        shipping = (row.get("shippingOptions") or [{}])[0].get("shippingCost") or {}
        condition = "new" if str(row.get("conditionId")) == "1000" else "unknown"
        return NormalizedOffer(platform="ebay", externalId=str(row.get("itemId", "unknown")), title=str(row.get("title", "eBay 商品")), url=str(row.get("itemWebUrl", "https://www.ebay.com")),
                                brand=None, model=None, specs={}, condition=condition, itemPrice=Decimal(str(price["value"])) if price.get("value") else None,
                                shippingFee=Decimal(str(shipping["value"])) if shipping.get("value") else None, currency=str(price.get("currency", "USD")),
                                sellerName=(row.get("seller") or {}).get("username"), positiveRate=None, reviewCount=None,
                                sourceFetchedAt=datetime.now(timezone.utc), source="eBay Browse API", sourceMode="live")
