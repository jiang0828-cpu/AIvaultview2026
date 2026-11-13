from __future__ import annotations

import math
from datetime import datetime, timezone

from .matching import match_offer
from .schemas import NormalizedOffer, SearchRequest


def completeness(offer: NormalizedOffer) -> float:
    fields = [offer.brand, offer.model, offer.item_price, offer.shipping_fee, offer.tax_fee, offer.service_fee,
              offer.coupon_discount, offer.subsidy, offer.seller_name, offer.seller_rating, offer.positive_rate,
              offer.review_count, offer.delivery_days, offer.return_policy]
    return round(sum(value is not None for value in fields) / len(fields) * 100, 1)


def rank_offers(request: SearchRequest, offers: list[NormalizedOffer]) -> list[NormalizedOffer]:
    rows = [match_offer(request, offer) for offer in offers]
    daily = request.category != "standard"
    def price_basis(row: NormalizedOffer) -> float | None:
        value = row.unit_price if daily else row.landed_price
        return float(value) if value is not None else None
    valid_prices = [value for row in rows if row.eligible and (value := price_basis(row)) is not None]
    minimum = min(valid_prices) if valid_prices else 0
    maxima: dict[str, float] = {}
    for row in rows:
        heat = sum(math.log1p(value) for value in [row.likes, row.shares, row.sales_count] if value is not None)
        maxima[row.platform] = max(maxima.get(row.platform, 0), heat)
    for row in rows:
        row.data_completeness = completeness(row)
        fetched_at = row.source_fetched_at
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - fetched_at).total_seconds() / 86400
        stale_after = 7 if daily else 30
        if age_days > stale_after:
            row.data_completeness = round(row.data_completeness * 0.7, 1)
            row.risks.append(f"报价已超过 {stale_after} 天未更新，价格、库存及优惠需重新确认")
        elif age_days < -1:
            row.data_completeness = round(row.data_completeness * 0.7, 1)
            row.risks.append("来源时间晚于当前时间，请复核报价时间")
        basis = price_basis(row)
        price = (100.0 if basis == 0 else round(100 * minimum / basis, 1)) if row.eligible and basis is not None else None
        quality = None
        if row.positive_rate is not None:
            samples = row.review_count or 0
            quality = round((row.positive_rate * samples + 70 * 20) / (samples + 20), 1)
        seller = round(((row.seller_rating if row.seller_rating is not None else 50) + (90 if row.return_policy else 50)) / 2, 1)
        delivery = max(10, 100 - (row.delivery_days or 0) * 8) if row.delivery_days is not None else None
        known_heat = [value for value in [row.likes, row.shares, row.sales_count] if value is not None]
        raw_heat = sum(math.log1p(value) for value in known_heat)
        heat = round(100 * raw_heat / maxima[row.platform], 1) if known_heat and maxima[row.platform] else None
        weights = {"price": .4, "quality": .25, "seller": .15, "delivery": .1, "completeness": .1}
        if request.preference == "price":
            weights.update(price=.6, quality=.1, seller=.1)
        if request.preference == "quality":
            weights.update(price=.2, quality=.4, seller=.2)
        components = {"price": price, "quality": quality, "seller": seller, "delivery": delivery, "completeness": row.data_completeness}
        total = sum(weights[key] * (value if value is not None else 50) for key, value in components.items())
        row.scores = {**components, "heat": heat, "total": round(total, 1)}
        row.reasons = []
        if row.eligible:
            row.reasons.append("品牌、型号、要求配置与成色完全匹配")
            if price == 100:
                row.reasons.append("同品牌、同包装规格合格商品中单位价最低" if daily else
                                   ("同币种合格商品中估算到手价最低" if row.price_status != "confirmed" else "同币种合格商品中确认到手价最低"))
            if daily and row.unit_price is not None:
                row.reasons.append(f"确认单位价 {row.unit_price:g} {row.currency}/{row.comparison_unit}，按净含量与包装数量核算")
            if row.price_status == "confirmed":
                row.reasons.append("商品价、运费、税费和优惠已录入确认")
            if quality is not None:
                row.reasons.append(f"已提供 {row.review_count or 0} 条评价，好评率 {row.positive_rate:g}%")
            if row.delivery_days is not None:
                row.reasons.append(f"预计 {row.delivery_days} 天送达")
        if row.source_mode == "demo":
            row.risks.append("合成演示数据，不代表真实在售商品、价格或评价")
        if row.source_mode == "manual":
            row.risks.append("手工录入报价，尚未经平台独立验证")
    rows.sort(key=lambda row: (not row.eligible, -(row.scores.get("total") or 0), row.platform, row.external_id))
    eligible = [row for row in rows if row.eligible][:3]
    for index, row in enumerate(eligible):
        row.rank = index + 1
    return rows
