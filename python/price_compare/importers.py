from __future__ import annotations

import csv
import io
import json
import uuid

from .schemas import ImportRequest, NormalizedOffer


def parse_import(request: ImportRequest) -> list[NormalizedOffer]:
    if request.format == "manual":
        values = request.data if isinstance(request.data, list) else [request.data]
    elif request.format == "json":
        parsed = json.loads(request.data) if isinstance(request.data, str) else request.data
        values = parsed if isinstance(parsed, list) else [parsed]
    else:
        if not isinstance(request.data, str):
            raise ValueError("CSV 导入内容必须是文本")
        values = list(csv.DictReader(io.StringIO(request.data)))
    if not values or len(values) > 200:
        raise ValueError("导入数据不能为空且不能超过 200 条")
    offers: list[NormalizedOffer] = []
    for value in values:
        if not isinstance(value, dict):
            raise ValueError("每条导入数据必须是对象")
        item = dict(value)
        aliases = {"external_id": "externalId", "item_price": "itemPrice", "shipping_fee": "shippingFee", "tax_fee": "taxFee", "service_fee": "serviceFee", "coupon_discount": "couponDiscount", "sales_count": "salesCount", "delivery_days": "deliveryDays", "return_policy": "returnPolicy", "source_url": "url"}
        for source, target in aliases.items():
            if source in item and target not in item:
                item[target] = item.pop(source)
        item.setdefault("externalId", f"import-{uuid.uuid4().hex[:10]}")
        item.setdefault("url", "https://example.com/manual-import")
        if isinstance(item.get("specs"), str):
            try:
                item["specs"] = json.loads(item["specs"])
            except json.JSONDecodeError:
                item["specs"] = {"raw": item["specs"]}
        for key, value in list(item.items()):
            if value == "":
                item[key] = None
        item.update(sourceMode="manual", source=item.get("source", "手工导入"))
        # Recommendation state is derived, never accepted from a saved snapshot
        # or a user-supplied import.
        for field in ["rank", "eligible", "matchLevel", "match_level", "scores", "reasons", "risks"]:
            item.pop(field, None)
        offers.append(NormalizedOffer.model_validate(item))
    return offers
