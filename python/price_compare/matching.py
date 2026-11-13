from __future__ import annotations

import re
import unicodedata
from datetime import date, timedelta

from .schemas import NormalizedOffer, SearchRequest, normalized_quantity


def canonical(value: object) -> str:
    # Keep punctuation that changes models, quantities, ratios or formulas.
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value)).lower())


def normalized_request(request: SearchRequest) -> SearchRequest:
    data = request.model_copy(deep=True)
    if data.condition == "unknown" and data.specs.get("condition") in {"new", "used", "refurbished"}:
        data.condition = data.specs.pop("condition")  # type: ignore[assignment]
    if not data.model:
        query = data.query
        phone = re.search(r"iphone\s*\d{1,2}(?:\s*(?:pro\s*max|pro|plus|air))?", query, re.I)
        if phone:
            data.model = phone.group(0)
            data.brand = data.brand or "Apple"
        else:
            data.model = query
    storage = re.search(r"(\d+)\s*(GB|TB)", data.query, re.I)
    if storage and "storage" not in data.specs:
        data.specs["storage"] = storage.group(1) + storage.group(2).upper()
    return data


def match_offer(request: SearchRequest, offer: NormalizedOffer) -> NormalizedOffer:
    offer = offer.model_copy(deep=True)
    # Ranks are computed for this request only, never accepted from imports or
    # previous snapshots.
    offer.rank = None
    issues: list[str] = []
    same_model = bool(request.model and offer.model and canonical(request.model) == canonical(offer.model))
    if not same_model:
        issues.append("型号不同或未确认")
    if request.brand and (not offer.brand or canonical(request.brand) != canonical(offer.brand)):
        issues.append("品牌不同或未确认")
    if request.condition != "unknown" and offer.condition != request.condition:
        issues.append("商品成色不符合要求")
    if offer.condition == "unknown":
        issues.append("商品成色未确认")
    daily = request.category != "standard"
    if daily:
        if not request.brand or not str(request.specs.get("variant") or "").strip():
            issues.append("请确认品牌及口味、配方或版本后进行同款推荐")
        if offer.condition != "new":
            issues.append("日常消耗品仅推荐全新未使用商品")
        if offer.category != request.category:
            issues.append("日常消费品类别不一致或未确认")
        request_quantity, request_unit = normalized_quantity(request.pack_count, request.net_weight, request.unit)
        if request_quantity is None:
            issues.append("请确认单包装净含量、单位及包装数量")
        elif offer.pack_count != request.pack_count:
            issues.append("包装数量不同或未确认，仅可参考单位价")
        elif offer.total_quantity != request_quantity or offer.comparison_unit != request_unit:
            issues.append("单包装净含量或计量单位不同或未确认")
    for key, expected in request.specs.items():
        if expected is None or str(expected).strip() == "":
            continue
        actual = offer.specs.get(key)
        if actual is None or canonical(actual) != canonical(expected):
            issues.append(f"配置 {key} 不一致或未确认")
    for required in request.required_conditions:
        # Free text is not proof of a hard condition: e.g. "无官方保修"
        # contains "官方保修" but explicitly denies it. Require an exact field
        # value; users can record warranty/region/variant in structured specs.
        evidence = {canonical(value) for value in [offer.brand, offer.model, offer.return_policy,
                    {"new": "全新", "used": "二手", "refurbished": "翻新"}.get(offer.condition),
                    *offer.specs.values()] if value is not None}
        if not canonical(required) or canonical(required) not in evidence:
            issues.append(f"必须条件未确认：{required}")
    offer.match_level = "exact" if not issues else ("near" if same_model else "similar")
    offer.risks = issues[:]
    if offer.currency != request.currency:
        offer.risks.append("币种不同，仅作参考；未进行汇率换算")
    if offer.landed_price is None:
        offer.risks.append("缺少可计算的核心价格信息")
    if offer.price_status != "confirmed":
        offer.risks.append("到手价为估算，运费、税费或优惠尚未全部确认")
    if offer.shipping_fee is None:
        offer.risks.append("运费未确认")
    if offer.review_count is None or offer.review_count < 10:
        offer.risks.append("评价样本不足，建议人工复核")
    expired = offer.expires_on is not None and offer.expires_on < date.today()
    if expired:
        offer.risks.append("商品已超过标注保质期，不进入推荐")
    elif daily and request.category in {"food", "drink"} and offer.expires_on is None:
        offer.risks.append("保质期未确认，请购买前核对生产日期、保质期与储存条件")
    elif daily and request.category in {"food", "drink"} and offer.expires_on is not None:
        if (offer.expires_on - date.today()).days <= 30:
            offer.risks.append("剩余保质期不足31天，请确认能否及时用完及到货日期")
    if request.budget_max is not None and (offer.landed_price is None or offer.landed_price > request.budget_max):
        offer.risks.append("超出预算或无法确认是否满足预算")
    delivery_ok = True
    if daily and request.category in {"food", "drink"} and offer.expires_on is not None:
        if offer.delivery_days is not None and date.today() + timedelta(days=offer.delivery_days) > offer.expires_on:
            delivery_ok = False
            offer.risks.append("预计送达时已超过保质期，不进入推荐")
        elif offer.delivery_days is None:
            offer.risks.append("配送时效未确认，请复核到货时的剩余保质期")
    if request.target_date:
        try:
            deadline = date.fromisoformat(request.target_date)
        except ValueError:
            deadline = date.min
        delivery_ok = delivery_ok and offer.delivery_days is not None and date.today() + timedelta(days=offer.delivery_days) <= deadline
        if not delivery_ok:
            offer.risks.append("无法确认在目标日期前送达")
    offer.eligible = (offer.match_level == "exact" and offer.currency == request.currency
                      and offer.landed_price is not None and delivery_ok and not expired
                      and (request.budget_max is None or offer.landed_price <= request.budget_max))
    return offer
