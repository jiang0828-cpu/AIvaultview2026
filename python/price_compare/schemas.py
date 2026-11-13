from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Condition = Literal["new", "used", "refurbished", "unknown"]
MatchLevel = Literal["exact", "near", "similar"]
ProductCategory = Literal["standard", "food", "drink", "household"]
QuantityUnit = Literal["g", "kg", "ml", "l", "piece"]


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class SearchRequest(APIModel):
    query: str = Field(min_length=1, max_length=160)
    brand: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=100)
    category: ProductCategory = "standard"
    pack_count: int | None = Field(default=None, alias="packCount", gt=0, le=100000)
    net_weight: Decimal | None = Field(default=None, alias="netWeight", gt=0, le=1000000)
    unit: QuantityUnit | None = None
    specs: dict[str, str | int | float | bool | None] = Field(default_factory=dict, max_length=24)
    condition: Condition = "unknown"
    budget_max: Decimal | None = Field(default=None, alias="budgetMax", ge=0, le=100000000)
    currency: str = Field(default="CNY", pattern=r"^[A-Z]{3}$")
    platforms: list[str] = Field(default_factory=lambda: ["demo"], max_length=10)
    city: str | None = Field(default=None, max_length=80)
    target_date: str | None = Field(default=None, alias="targetDate", max_length=20)
    required_conditions: list[str] = Field(default_factory=list, alias="requiredConditions", max_length=12)
    acceptable_conditions: list[str] = Field(default_factory=list, alias="acceptableConditions", max_length=12)
    preference: Literal["balanced", "price", "quality"] = "balanced"
    mode: Literal["demo", "live"] = "demo"
    demo_scenario: Literal["phone", "laptop", "mixed", "food", "drink", "household"] = Field(default="phone", alias="demoScenario")

    @field_validator("currency", mode="before")
    @classmethod
    def uppercase_currency(cls, value: Any) -> Any:
        return value.upper() if isinstance(value, str) else value


class NormalizedOffer(APIModel):
    id: int | None = None
    rank: int | None = None
    platform: str = Field(min_length=1, max_length=40)
    external_id: str = Field(alias="externalId", min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=500)
    url: str = Field(min_length=1, max_length=2048)
    brand: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    category: str | None = Field(default=None, max_length=80)
    pack_count: int | None = Field(default=None, alias="packCount", gt=0, le=100000)
    net_weight: Decimal | None = Field(default=None, alias="netWeight", gt=0, le=1000000)
    unit: QuantityUnit | None = None
    total_quantity: Decimal | None = Field(default=None, alias="totalQuantity", gt=0)
    comparison_unit: str | None = Field(default=None, alias="comparisonUnit")
    unit_price: Decimal | None = Field(default=None, alias="unitPrice", ge=0)
    expires_on: date | None = Field(default=None, alias="expiresOn")
    specs: dict[str, str | int | float | bool | None] = Field(default_factory=dict, max_length=24)
    condition: Condition = "unknown"
    item_price: Decimal | None = Field(default=None, alias="itemPrice", ge=0)
    shipping_fee: Decimal | None = Field(default=None, alias="shippingFee", ge=0)
    tax_fee: Decimal | None = Field(default=None, alias="taxFee", ge=0)
    coupon_discount: Decimal | None = Field(default=None, alias="couponDiscount", ge=0)
    service_fee: Decimal | None = Field(default=None, alias="serviceFee", ge=0)
    subsidy: Decimal | None = Field(default=None, ge=0)
    landed_price: Decimal | None = Field(default=None, alias="landedPrice", ge=0)
    price_status: Literal["confirmed", "estimated", "incomplete"] = Field(default="incomplete", alias="priceStatus")
    currency: str = Field(default="CNY", pattern=r"^[A-Z]{3}$")
    seller_name: str | None = Field(default=None, alias="sellerName", max_length=160)
    seller_rating: float | None = Field(default=None, alias="sellerRating", ge=0, le=100)
    positive_rate: float | None = Field(default=None, alias="positiveRate", ge=0, le=100)
    review_count: int | None = Field(default=None, alias="reviewCount", ge=0)
    likes: int | None = Field(default=None, ge=0)
    shares: int | None = Field(default=None, ge=0)
    sales_count: int | None = Field(default=None, alias="salesCount", ge=0)
    delivery_days: int | None = Field(default=None, alias="deliveryDays", ge=0, le=365)
    return_policy: str | None = Field(default=None, alias="returnPolicy", max_length=500)
    source_fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="sourceFetchedAt")
    source: str = "manual"
    source_mode: Literal["demo", "live", "manual"] = Field(default="manual", alias="sourceMode")
    data_completeness: float = Field(default=0, alias="dataCompleteness", ge=0, le=100)
    match_level: MatchLevel = Field(default="similar", alias="matchLevel")
    eligible: bool = False
    reasons: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    scores: dict[str, float | None] = Field(default_factory=dict)

    @field_validator("currency", mode="before")
    @classmethod
    def uppercase_currency(cls, value: Any) -> Any:
        return value.upper() if isinstance(value, str) else value

    @field_validator("url")
    @classmethod
    def valid_url(cls, value: str) -> str:
        url = urlparse(value)
        if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
            raise ValueError("商品链接须为不含凭据的 HTTP(S) 链接")
        return value

    @model_validator(mode="after")
    def validate_prices(self) -> "NormalizedOffer":
        if self.source_mode != "demo":
            validate_platform_url(self.platform, self.url)
        self.landed_price = calculate_landed(self)
        self.price_status = "incomplete" if self.landed_price is None else ("confirmed" if all(
            value is not None for value in [self.shipping_fee, self.tax_fee, self.service_fee,
                                           self.coupon_discount, self.subsidy]) else "estimated")
        self.total_quantity, self.comparison_unit = normalized_quantity(self.pack_count, self.net_weight, self.unit)
        self.unit_price = ((self.landed_price / self.total_quantity).quantize(Decimal("0.0001"))
                           if self.landed_price is not None and self.total_quantity else None)
        return self


def validate_platform_url(platform: str, value: str) -> None:
    roots = {"jd": ("jd.com", "jd.hk"), "ebay": ("ebay.com", "ebay.co.uk", "ebay.de", "ebay.com.au", "ebay.ca", "ebay.fr", "ebay.it", "ebay.es"),
             "goofish": ("goofish.com", "2.taobao.com"), "douyin": ("douyin.com", "jinritemai.com"),
             "pinduoduo": ("pinduoduo.com", "yangkeduo.com")}
    if platform not in roots:
        return
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.port not in {None, 443} or not any(host == root or host.endswith("." + root) for root in roots[platform]):
        raise ValueError("商品链接必须是对应平台的 HTTPS 地址，请核对平台和链接")


def normalized_quantity(pack_count: int | None, net_weight: Decimal | None, unit: str | None) -> tuple[Decimal | None, str | None]:
    """Quantity is per-pack content times pack count, normalized to kg/l/piece."""
    if pack_count is None or net_weight is None or unit is None:
        return None, None
    factors = {"g": (Decimal("0.001"), "kg"), "kg": (Decimal("1"), "kg"),
               "ml": (Decimal("0.001"), "l"), "l": (Decimal("1"), "l"), "piece": (Decimal("1"), "piece")}
    factor, comparison_unit = factors[unit]
    return Decimal(pack_count) * net_weight * factor, comparison_unit


def calculate_landed(offer: NormalizedOffer) -> Decimal | None:
    if offer.item_price is None:
        return None
    # A missing cost is unknown, not free. Only an explicitly entered zero is
    # treated as confirmed free shipping/tax/service/discount.
    if any(value is None for value in [offer.shipping_fee, offer.tax_fee, offer.service_fee,
                                       offer.coupon_discount, offer.subsidy]):
        return None
    return max(Decimal("0"), offer.item_price - (offer.coupon_discount or 0) - (offer.subsidy or 0)
               + (offer.shipping_fee or 0) + (offer.tax_fee or 0) + (offer.service_fee or 0)).quantize(Decimal("0.01"))


class SearchResponse(APIModel):
    run_id: str = Field(alias="runId")
    status: Literal["completed", "partial", "empty"]
    request: SearchRequest
    summary: dict[str, Any]
    recommendations: list[NormalizedOffer]
    offers: list[NormalizedOffer]


class ImportRequest(APIModel):
    format: Literal["manual", "json", "csv"] = "manual"
    data: Any


class FavoriteRequest(APIModel):
    offer_id: int = Field(alias="offerId", gt=0)
    note: str = Field(default="", max_length=1000)


class FavoriteUpdate(APIModel):
    note: str = Field(default="", max_length=1000)
