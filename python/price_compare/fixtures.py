from __future__ import annotations

from .schemas import NormalizedOffer, SearchRequest


def daily_offers(request: SearchRequest) -> list[NormalizedOffer]:
    products = {
        "food": ("示例粮坊", "原味燕麦片", 500, "g", 2, "原味", [29.9, 27.8, 31.5]),
        "drink": ("示例牧场", "全脂纯牛奶", 250, "ml", 12, "全脂", [49.9, 46.8, 48.5]),
        "household": ("示例净护", "无香洗衣液", 2, "l", 2, "无香标准浓度", [35.9, 32.8, 34.5]),
    }
    brand, model, quantity, unit, count, variant, prices = products[request.demo_scenario]
    rows = []
    for index, platform in enumerate(["jd", "pinduoduo", "douyin", "jd", "goofish", "pinduoduo"]):
        pack_count = count if index != 3 else count * 2
        amount = quantity if index != 4 else quantity / 2
        item_price = prices[index] if index < 3 else [49.0, 19.9, 25.8][index - 3]
        specs = {"variant": variant if index != 4 else "其他配方"}
        rows.append(NormalizedOffer(
            platform=platform, externalId=f"demo-{request.demo_scenario}-{index}",
            title=f"[演示] {brand} {model} {amount}{unit}×{pack_count}",
            url=f"https://example.com/demo/{request.demo_scenario}/{index}", brand=brand, model=model,
            category=request.demo_scenario, packCount=pack_count, netWeight=amount, unit=unit,
            specs=specs, condition="new", itemPrice=item_price,
            shippingFee=None if index == 5 else 0, taxFee=0, serviceFee=0, couponDiscount=0, subsidy=0,
            currency="CNY", sellerName=f"演示商家 {index + 1}", sellerRating=96 - index,
            positiveRate=97.8 if index < 3 else None, reviewCount=500 + index * 200 if index < 3 else None,
            deliveryDays=2 + index % 2, returnPolicy="演示：未开封可退，具体以商家规则为准",
            source="合成日常消费品样例，非真实报价", sourceMode="demo"))
    requested = set(request.platforms)
    return rows if "demo" in requested else [row for row in rows if row.platform in requested]


def demo_offers(request: SearchRequest) -> list[NormalizedOffer]:
    if request.demo_scenario in {"food", "drink", "household"}:
        return daily_offers(request)
    laptop = request.demo_scenario == "laptop"
    model = "ThinkBook 14 G7" if laptop else "iPhone 16"
    brand = "Lenovo" if laptop else "Apple"
    base_specs = {"memory": "16GB", "storage": "1TB", "region": "国行", "warranty": "官方保修"} if laptop else {"storage": "256GB", "region": "国行", "warranty": "官方保修"}
    rows = []
    for index, (platform, price) in enumerate([("jd", 4899), ("pinduoduo", 4799), ("douyin", 4859), ("goofish", 4300), ("ebay", 699), ("jd", 4500), ("pinduoduo", 4700)]):
        specs = base_specs.copy()
        condition = "new"
        if index == 3:
            condition = "used"
        if index == 5:
            specs["memory" if laptop else "storage"] = "8GB" if laptop else "128GB"
        offer = NormalizedOffer(platform=platform, externalId=f"demo-{request.demo_scenario}-{index}",
                                title=f"[演示] {brand} {model} {'/'.join(specs.values())}",
                                url=f"https://example.com/demo/{request.demo_scenario}/{index}", brand=brand, model=model,
                                specs=specs, condition=condition, itemPrice=price, shippingFee=None if index == 6 else 0,
                                taxFee=0, serviceFee=0, couponDiscount=0, subsidy=0,
                                currency="USD" if platform == "ebay" else "CNY", sellerName=f"演示商家 {index + 1}",
                                sellerRating=[98, 96, 95, 90, 98, 95, 89][index], positiveRate=None if index == 6 else 97 + index / 10,
                                reviewCount=None if index == 6 else 300 + index * 200, likes=None if index == 6 else 100 + index * 50,
                                shares=None if index == 6 else 10 + index * 3, salesCount=None if index == 6 else 300 + index * 100,
                                deliveryDays=2 + index % 3, returnPolicy="演示：7 天退货，官方保修", source="合成固定演示数据", sourceMode="demo")
        rows.append(offer)
    requested = set(request.platforms)
    if "demo" not in requested:
        rows = [row for row in rows if row.platform in requested]
    return rows
