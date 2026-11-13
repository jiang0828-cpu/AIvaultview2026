from __future__ import annotations

import csv
import io
import json
import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import Integer, String, Text, UniqueConstraint, select
from sqlalchemy.orm import Mapped, mapped_column

from .models import Base
from .investment_data import InvestmentSync, MarketSnapshot, live_valuation


class InvestmentRecord(Base):
    __tablename__ = "investment_records"
    __table_args__ = (UniqueConstraint("user_id", "project_id", "kind", "key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    project_id: Mapped[int] = mapped_column(Integer, index=True)
    kind: Mapped[str] = mapped_column(String(30))
    key: Mapped[str] = mapped_column(String(80))
    payload: Mapped[str] = mapped_column(Text)


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


Money = Decimal
Category = Literal["etf", "equity_fund", "bond_fund", "money_fund", "stock", "bond"]


class Account(Model):
    cash: Money = Field(default=Decimal(0), ge=0, le=1e12)
    liabilities: Money = Field(default=Decimal(0), ge=0, le=1e12)
    emergency: Money = Field(default=Decimal(0), ge=0, le=1e12)
    expense1y: Money = Field(default=Decimal(0), ge=0, le=1e12)
    expense3y: Money = Field(default=Decimal(0), ge=0, le=1e12)
    monthly: Money = Field(default=Decimal(0), ge=0, le=1e10)
    horizon: int = Field(default=36, ge=1, le=600)
    lossAmount: Money = Field(default=Decimal(0), ge=0, le=1e12)
    maxDrawdown: float = Field(default=15, gt=0, le=100)
    riskLevel: int = Field(default=2, ge=1, le=5)
    updatedOn: date = Field(default_factory=date.today)


class Product(Model):
    code: str = Field(pattern=r"^[A-Za-z0-9.-]{1,20}$")
    name: str = Field(min_length=1, max_length=100)
    category: Category
    peer: str = Field(min_length=1, max_length=80)
    shareClass: str = Field(default="未确认", min_length=1, max_length=20)
    riskLevel: int = Field(ge=1, le=5)
    minMonths: int = Field(ge=0, le=600)
    annualReturn: float | None = Field(default=None, ge=-100, le=1000)
    drawdown: float | None = Field(default=None, ge=0, le=100)
    managementFee: float | None = Field(default=None, ge=0, le=10)
    custodyFee: float | None = Field(default=None, ge=0, le=10)
    salesFee: float | None = Field(default=None, ge=0, le=10)
    subscriptionFee: float | None = Field(default=None, ge=0, le=100)
    redemptionFee: float | None = Field(default=None, ge=0, le=100)
    trackingError: float | None = Field(default=None, ge=0, le=100)
    premium: float | None = Field(default=None, ge=-100, le=100)
    turnover: Money | None = Field(default=None, ge=0, le=1e15)
    duration: float | None = Field(default=None, ge=0, le=100)
    credit: str | None = Field(default=None, max_length=80)
    managerTenure: float | None = Field(default=None, ge=0, le=100)
    returnPeriod: str = Field(default="近一年", max_length=40)
    liquidity: str = Field(default="", max_length=300)
    restrictions: str = Field(default="", max_length=500)
    logic: str = Field(default="", max_length=1500)
    risks: str = Field(default="", max_length=1500)
    reassess: str = Field(default="", max_length=1500)
    active: bool = True
    sourceUrl: str
    sourceName: str = Field(min_length=1, max_length=100)
    asOf: date
    publishedAt: datetime
    fetchedAt: datetime
    exposures: dict[str, float] = Field(default_factory=dict, max_length=50)
    holdings: dict[str, float] = Field(default_factory=dict, max_length=100)
    demo: bool = False
    dataCode: str | None = Field(default=None, pattern=r"^\d{6}\.(SH|SZ|OF)$")
    autoUpdate: bool = True
    market: MarketSnapshot | None = None

    @field_validator("sourceUrl")
    @classmethod
    def source_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in {None, 443}:
            raise ValueError("来源必须为不含凭据的 HTTPS 地址")
        return value

    @field_validator("publishedAt", "fetchedAt")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("披露与获取时间须含时区")
        return value

    @field_validator("exposures", "holdings")
    @classmethod
    def weights(cls, value: dict[str, float]) -> dict[str, float]:
        if any(not math.isfinite(v) or v < 0 or v > 100 or not k.strip() for k, v in value.items()) or sum(value.values()) > 100.01:
            raise ValueError("穿透权重须为0至100的百分比，合计不超过100")
        return value

    @model_validator(mode="after")
    def timestamps(self) -> Product:
        if self.dataCode and (self.code not in {self.dataCode,self.dataCode.split(".")[0]} or self.category == "etf" and self.dataCode.endswith(".OF")):
            raise ValueError("dataCode须与产品代码及交易市场一致")
        if self.publishedAt > self.fetchedAt or self.asOf > self.publishedAt.date():
            raise ValueError("数据日、披露时间、获取时间顺序不正确")
        return self


class Position(Model):
    code: str = Field(pattern=r"^[A-Za-z0-9.-]{1,20}$")
    name: str = Field(min_length=1, max_length=100)
    category: Category
    units: Money = Field(ge=0, le=1e12)
    price: Money = Field(ge=0, le=1e12)
    cost: Money = Field(ge=0, le=1e12)
    asOf: date


class Transaction(Model):
    key: str = Field(pattern=r"^[A-Za-z0-9_-]{1,60}$")
    date: date
    code: str = Field(default="CASH", pattern=r"^[A-Za-z0-9.-]{1,20}$")
    kind: Literal["buy", "sell", "deposit", "withdrawal", "dividend", "fee"]
    amount: Money = Field(gt=0, le=1e12)
    fee: Money = Field(default=Decimal(0), ge=0, le=1e10)
    note: str = Field(default="", max_length=1500)


class Valuation(Model):
    date: date
    value: Money = Field(gt=0, le=1e15)
    flow: Money = Field(default=Decimal(0), ge=-1e12, le=1e12)
    fixedBenchmark: Money | None = Field(default=None, gt=0, le=1e15)
    simpleBenchmark: Money | None = Field(default=None, gt=0, le=1e15)


class Comparison(Model):
    codes: list[str] = Field(min_length=1, max_length=10)
    amount: Money = Field(default=Decimal(10000), gt=0, le=1e12)
    months: int = Field(default=36, ge=1, le=600)
    demo: bool = False


class Import(Model):
    kind: Literal["products", "positions", "transactions", "valuations"]
    format: Literal["json", "csv"] = "json"
    data: str | list[dict[str, Any]]


def plain(model: BaseModel) -> dict[str, Any]:
    # Explicit conversion keeps monetary arithmetic Decimal until the boundary.
    return json.loads(model.model_dump_json())


def demo_data() -> dict[str, Any]:
    today = date.today()
    now = datetime.now(timezone.utc)
    products = []
    for i, (category, peer, name, fee, dd) in enumerate([
        ("etf", "示例宽基指数", "宽基ETF甲", .15, 20), ("etf", "示例宽基指数", "宽基ETF乙", .3, 21),
        ("etf", "示例宽基指数", "宽基ETF丙", .2, 19), ("equity_fund", "示例主动权益", "主动权益A", 1.2, 27),
        ("bond_fund", "示例纯债", "中短债示例", .3, 3), ("stock", "股票观察", "股票观察示例", 0, 35),
        ("bond", "债券观察", "债券观察示例", 0, 5), ("money_fund", "示例现金管理", "现金管理示例", .15, .2),
    ]):
        equity = category in {"etf", "equity_fund", "stock"}
        products.append(plain(Product(code=f"DEMO{i+1:02}", name=f"[演示] {name}", category=category, peer=peer, shareClass="场内" if category in {"etf","stock","bond"} else "A",
            riskLevel=3 if equity else 2, minMonths=60 if equity else 12, annualReturn=8+i*.2 if equity else 2.1,
            drawdown=dd, managementFee=fee, custodyFee=.05, salesFee=0, subscriptionFee=0, redemptionFee=0,
            trackingError=.4+i*.1, premium=.1, turnover=50000000, duration=1.5, credit="合成信用结构，非评级",
            managerTenure=4, logic="合成示例：承担资产波动，收益来源为持有资产的收益及价格变化。",
            risks="价格下跌、流动性与信用风险；历史回撤不能限制未来亏损。", reassess="期限或资金用途改变、费用/持仓结构变化时复核。",
            liquidity="合成规则，请勿据此交易", restrictions="不可购买的演示产品", sourceName="本地合成数据",
            sourceUrl="https://www.sse.com.cn/assortment/fund/etf/home/", asOf=today, publishedAt=now, fetchedAt=now,
            exposures={"权益": 100} if equity else {"债券": 100}, holdings={"示例成分甲": 30, "示例成分乙": 20} if equity else {}, demo=True)))
    account = Account(cash=100000, emergency=30000, expense1y=10000, expense3y=10000, lossAmount=30000, maxDrawdown=30, riskLevel=3, horizon=60)
    points = []
    for n, (value, flow) in enumerate([(100000, 0), (112000, 10000), (114000, 0), (119000, 5000)]):
        points.append(plain(Valuation(date=today-timedelta(days=(3-n)*30), value=value, flow=flow,
            fixedBenchmark=[100000,111000,112000,118000][n], simpleBenchmark=[100000,110500,111000,117000][n])))
    return {"account": plain(account), "products": products, "positions": [], "transactions": [], "valuations": points}


def portfolio(account: Account, positions: list[Position], products: list[Product]) -> dict[str, Any]:
    values = {p.code: p.units*p.price for p in positions}
    invested = sum(values.values(), Decimal(0))
    reserved = account.emergency+account.expense1y+account.expense3y+account.liabilities
    available = max(Decimal(0), account.cash-reserved)
    warnings = []
    if account.cash < reserved:
        warnings.append("现金不足以覆盖应急、未来确定支出与负债预留，暂停新增风险投资候选。")
    if account.lossAmount <= 0:
        warnings.append("尚未填写可承担亏损金额，暂停新增风险投资候选。")
    if (date.today()-account.updatedOn).days > 30 or account.updatedOn > date.today():
        warnings.append("资金计划已过期或日期异常，请先更新。")
    if any((date.today()-p.asOf).days > 7 or p.asOf > date.today() for p in positions):
        warnings.append("持仓估值已过期或日期异常，组合分析需先复核。")
    exposures: dict[str, Decimal] = {}
    lookup = {p.code: p for p in products}
    if any(p.code in lookup and ((date.today()-lookup[p.code].asOf).days > 7 or lookup[p.code].asOf > date.today()
                                or lookup[p.code].category != p.category) for p in positions):
        warnings.append("现有持仓的产品档案过期或类别冲突，请先核对组合资料。")
    for position in positions:
        product = lookup.get(position.code)
        weights = product.exposures if product else {}
        for sector, weight in weights.items():
            exposures[sector] = exposures.get(sector, Decimal(0)) + values[position.code]*Decimal(str(weight))/100
        unknown = 100-sum(weights.values())
        exposures["未穿透"] = exposures.get("未穿透", Decimal(0))+values[position.code]*Decimal(str(unknown))/100
    existing_stress = sum((values[p.code]*Decimal(str(max(lookup[p.code].drawdown or 0, 30 if lookup[p.code].riskLevel >= 3 else 10)))/100
                           if p.code in lookup else values[p.code] for p in positions), Decimal(0))
    if invested > 0 and existing_stress >= account.lossAmount:
        warnings.append("现有持仓压力损失已占满亏损预算，暂停新增风险投资候选。")
    return {"cash": float(account.cash), "invested": float(invested), "netAssets": float(account.cash+invested-account.liabilities),
        "reserved": float(reserved), "available": float(available), "warnings": warnings,
        "existingStress": float(existing_stress), "remainingLossBudget": float(max(Decimal(0), account.lossAmount-existing_stress)),
        "exposures": {k: float(v) for k,v in exposures.items() if v}, "ready": not warnings and available > 0}


def product_issues(p: Product) -> list[str]:
    missing = []
    if not p.demo and p.autoUpdate and (p.market is None or p.market.status != "ready"):
        missing.append("自动行情未就绪或已过期，暂停自动候选")
    if p.shareClass == "未确认":
        missing.append("缺少份额类别或场内标识")
    for field in ["drawdown", "managementFee", "custodyFee", "salesFee", "subscriptionFee", "redemptionFee"]:
        if getattr(p, field) is None:
            missing.append(f"缺少 {field}")
    for field in ["logic", "risks", "reassess", "liquidity", "restrictions"]:
        if not getattr(p, field).strip():
            missing.append(f"缺少 {field}")
    if p.category == "etf" and any(v is None for v in [p.trackingError, p.premium, p.turnover]):
        missing.append("缺少跟踪误差、折溢价或成交额")
    if p.category == "bond_fund" and (p.duration is None or not p.credit):
        missing.append("缺少久期或信用结构")
    if p.category == "equity_fund" and p.managerTenure is None:
        missing.append("缺少经理任期")
    if date.today()-p.asOf > timedelta(days=7) or p.asOf > date.today() or p.fetchedAt > datetime.now(timezone.utc)+timedelta(minutes=5):
        missing.append("数据过期或时间异常")
    if not p.active:
        missing.append("暂停交易或已终止")
    return missing


def candidates(account: Account, positions: list[Position], products: list[Product], category: str, peer: str) -> dict[str, Any]:
    summary = portfolio(account, positions, products)
    if category in {"stock", "bond"}:
        return {"candidates": [], "excluded": [], "message": "股票与直接债券仅提供观察研究，不做自动候选排序。"}
    eligible = []
    excluded = []
    by_code = {p.code: p for p in products}
    for p in products:
        if p.category != category or p.peer != peer:
            continue
        issues = product_issues(p)
        if p.riskLevel > account.riskLevel or p.minMonths > account.horizon:
            issues.append("风险等级或资金期限不匹配")
        if p.drawdown is not None and p.drawdown > account.maxDrawdown:
            issues.append("历史回撤超过设定的研究上限")
        if p.category == "etf" and p.premium is not None and abs(p.premium) > 1:
            issues.append("折溢价超过1%，需人工复核交易价格")
        if not summary["ready"]:
            issues.append("资金或持仓资料不满足新增投资条件")
        if issues:
            excluded.append({"code": p.code, "name": p.name, "reasons": issues})
            continue
        annual_fee = sum(v or 0 for v in [p.managementFee, p.custodyFee, p.salesFee])
        # Scores are local rule-fit indicators, never return forecasts.
        score = max(0, 100-annual_fee*10-(p.drawdown or 0))
        if category == "etf":
            score -= (p.trackingError or 0)*5 + abs(p.premium or 0)*5
        overlaps = []
        for held in positions:
            other = by_code.get(held.code)
            if other and (other.peer == p.peer or (other.holdings and p.holdings)):
                weight = sum(min(w, other.holdings.get(k, 0)) for k,w in p.holdings.items())
                if other.peer == p.peer or weight > 0:
                    overlaps.append(f"与 {held.name} {'跟踪同一基准；' if other.peer == p.peer else ''}已披露成分重叠 {weight:.1f}%（非完整穿透）")
        stress = max(p.drawdown or 0, 30 if p.riskLevel >= 3 else 10)
        loss_bound = summary["remainingLossBudget"]/(stress/100)
        eligible.append({"product": plain(p), "score": round(score,1), "reasons": ["资金期限和风险等级符合所设规则", f"同类年度基金层费率合计 {annual_fee:.2f}%", f"历史回撤 {p.drawdown}%（不能代表未来最大亏损）"],
            "logic": p.logic, "risks": p.risks, "overlap": overlaps or ["暂无可确认重叠；缺失持仓成分不等于没有重叠。"],
            "reassess": p.reassess, "stressPercent": stress, "researchCeiling": round(min(summary["available"], loss_bound),2),
            "sizingNote": "仅为新增现金和压力情景的单项研究上界，不可对多个候选叠加使用；不是建议购买金额。"})
    eligible.sort(key=lambda row: (-row["score"], row["product"]["code"]))
    return {"candidates": eligible[:3], "excluded": excluded, "message": "规则匹配候选，非上涨概率；可选择今天无需操作。" if eligible else "今天无需操作：没有满足全部资料与资金条件的候选。"}


def compare_products(products: list[Product], request: Comparison) -> dict[str, Any]:
    lookup = {p.code:p for p in products}
    selected = [lookup.get(code) for code in request.codes]
    if any(p is None for p in selected):
        raise ValueError("所选产品不存在")
    rows = [p for p in selected if p is not None]
    if len({(p.category,p.peer) for p in rows}) != 1:
        raise ValueError("仅能比较同类且基准/同类组一致的产品")
    result = []
    for p in rows:
        annual = [p.managementFee,p.custodyFee,p.salesFee]
        cost = None
        if all(v is not None for v in [*annual,p.subscriptionFee,p.redemptionFee]):
            annual_rate = sum((Decimal(str(v)) for v in annual if v is not None), Decimal(0))
            cost = request.amount*(annual_rate*request.months/12+Decimal(str(p.subscriptionFee))+Decimal(str(p.redemptionFee)))/100
        result.append({"product": plain(p), "illustrativeCost": round(float(cost),2) if cost is not None else None, "issues": product_issues(p)})
    return {"rows": result, "amount": float(request.amount), "months": request.months,
        "costBasis": "恒定本金下按录入费率静态估算，申赎费用须对应持有期限；不是实际扣款。管理/托管/销售服务费通常已反映在基金净值中，复盘不重复扣除。"}


def returns(points: list[Valuation]) -> dict[str, Any]:
    rows = sorted(points, key=lambda p:p.date)
    if len(rows)<2:
        return {"ready":False,"message":"至少录入两个日期的完整账户日终估值。"}
    if len({p.date for p in rows}) != len(rows):
        raise ValueError("同一日期只能有一条账户估值")
    if rows[-1].date > date.today():
        raise ValueError("不能用未来估值计算实际收益")
    if rows[0].flow != 0:
        raise ValueError("首日估值作为期初本金，首日净流入请填0，避免重复计算")
    twr = Decimal(1)
    peak = Decimal(1)
    drawdown = Decimal(0)
    curve = []
    for i,p in enumerate(rows):
        if i:
            factor = (p.value-p.flow)/rows[i-1].value
            if factor <= 0:
                raise ValueError("净流入必须小于该日账户价值；请核对日终口径")
            twr *= factor
        peak = max(peak,twr)
        drawdown = max(drawdown,1-twr/peak)
        curve.append({"date":str(p.date),"value":float(p.value),"strategy":round(float(twr-1)*100,4)})
    profit = rows[-1].value-rows[0].value-sum((p.flow for p in rows[1:]),Decimal(0))
    # Cash flows are at period end. Buy/sell within the account are internal.
    flows = [(rows[0].date,-float(rows[0].value))]+[(p.date,-float(p.flow)) for p in rows[1:] if p.flow]+[(rows[-1].date,float(rows[-1].value))]
    aggregated: dict[date,float] = {}
    for day,value in flows:
        aggregated[day] = aggregated.get(day,0)+value
    signs = [1 if v>0 else -1 for _,v in sorted(aggregated.items()) if v]
    changes = sum(a!=b for a,b in zip(signs,signs[1:]))
    xirr = None
    if changes == 1:
        years = [(d-rows[0].date).days/365 for d,_ in flows]
        def npv(log_rate: float) -> float:
            exponents = [-log_rate*t for t in years]
            scale = max(exponents)
            return sum(v*math.exp(max(-745, exponent-scale)) for (_,v),exponent in zip(flows,exponents))
        low,high = -20.0,20.0
        if npv(low)*npv(high)<0:
            for _ in range(150):
                mid=(low+high)/2
                if npv(low)*npv(mid)<=0:
                    high=mid
                else:
                    low=mid
            xirr=math.expm1((low+high)/2)*100
    benchmarks = {}
    for key in ["fixedBenchmark","simpleBenchmark"]:
        values = [getattr(p,key) for p in rows]
        if all(v is not None for v in values):
            if values[0] != rows[0].value:
                raise ValueError("基准影子账户必须使用相同的期初本金")
            factor=Decimal(1)
            valid=True
            for i in range(1,len(rows)):
                current,previous = values[i],values[i-1]
                if current is None or previous is None or current-rows[i].flow<=0:
                    valid=False
                    break
                factor *= (current-rows[i].flow)/previous
            benchmarks[key] = round(float(factor-1)*100,4) if valid else None
        else:
            benchmarks[key]=None
    return {"ready":True,"profit":float(profit),"netFlow":float(sum((p.flow for p in rows[1:]),Decimal(0))),
        "twr":round(float(twr-1)*100,4),"xirr":round(xirr,4) if xirr is not None else None,"maxDrawdown":round(float(drawdown)*100,4),
        "curve":curve,"benchmarks":benchmarks,"message":"TWR为区间收益；XIRR为年化资金加权收益，多次符号变化不报告唯一解。假设净流入在日终发生，流入日须有估值；现金分红留在账户内，提到外部才计负流入。估值应已扣实际费用。基准须与账户同起始本金、相同日期/流量、同费用与风险口径。"}


def investment_router(factory: Any, scope: Any, sync: InvestmentSync) -> APIRouter:
    router=APIRouter(prefix="/investment")
    classes: dict[str,Any]={"account":Account,"products":Product,"positions":Position,"transactions":Transaction,"valuations":Valuation}

    def read(identity: tuple[int,int]) -> dict[str,Any]:
        result: dict[str,Any]={"account":plain(Account()),"products":[],"positions":[],"transactions":[],"valuations":[]}
        with factory() as db:
            for row in db.scalars(select(InvestmentRecord).where(InvestmentRecord.user_id==identity[0],InvestmentRecord.project_id==identity[1])):
                if row.kind=="account":
                    result["account"]=json.loads(row.payload)
                else:
                    result[row.kind].append(json.loads(row.payload))
        result["sync"]=sync.decorate(result["products"])
        return result

    def parsed(data: dict[str,Any]) -> tuple[Account,list[Position],list[Product]]:
        return Account.model_validate(data["account"]),[Position.model_validate(p) for p in data["positions"]],[Product.model_validate(p) for p in data["products"]]

    @router.get("/state")
    def state(demo: bool=False, identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        data=demo_data() if demo else read(identity)
        account,positions,products=parsed(data)
        data["summary"]=portfolio(account,positions,products)
        data["demo"]=demo
        if demo:
            data["sync"]=sync.decorate([])
        data["liveValuation"]=live_valuation(data)
        data["providers"]=[{"name":"Tushare 自动行情","status":"已配置；具体接口权限及取数结果见同步状态" if sync.token else "等待TUSHARE_TOKEN授权，尚无真实自动行情"},{"name":"AI 阅读解释","status":"使用确定性规则解释；未调用外部模型，不发送账户数据"}]
        return data

    @router.post("/refresh",status_code=202)
    def refresh(_identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        sync.request_refresh()
        return {"queued":sync.enabled,"configured":bool(sync.token),"message":"已唤醒后台更新；遵守数据源刷新间隔。无授权时不会标记为实时。"}

    @router.put("/account")
    def save_account(account: Account, identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        save("account",[account],identity)
        return {"ok":True}

    def save(kind: str, models: list[BaseModel], identity: tuple[int,int]) -> None:
        with factory() as db:
            for model in models:
                item=plain(model)
                key=str(item.get("key") or item.get("code") or item.get("date") or "default")
                row=db.scalar(select(InvestmentRecord).where(InvestmentRecord.user_id==identity[0],InvestmentRecord.project_id==identity[1],InvestmentRecord.kind==kind,InvestmentRecord.key==key))
                if row:
                    row.payload=json.dumps(item,ensure_ascii=False)
                else:
                    db.add(InvestmentRecord(user_id=identity[0],project_id=identity[1],kind=kind,key=key,payload=json.dumps(item,ensure_ascii=False)))
            db.commit()

    @router.post("/import")
    def import_data(request: Import, identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        if isinstance(request.data,str):
            if len(request.data)>200000:
                raise ValueError("导入内容超过200KB")
            rows=json.loads(request.data) if request.format=="json" else list(csv.DictReader(io.StringIO(request.data.lstrip("\ufeff"))))
        else:
            rows=request.data
        if not isinstance(rows,list) or not 1<=len(rows)<=500:
            raise ValueError("请导入1至500条记录的数组")
        cleaned=[]
        for row in rows:
            if not isinstance(row,dict):
                raise ValueError("每条记录必须是对象")
            row={k:v for k,v in row.items() if v!=""}
            if request.kind=="products":
                if row.get("market") is not None:
                    raise ValueError("自动行情字段由服务维护，导入前请移除market字段")
                if row.get("demo") is True or str(row.get("code","")).startswith("DEMO"):
                    raise ValueError("合成演示产品不能导入真实研究清单，请使用已核实的真实档案")
                row["demo"]=False
                for key in ["exposures","holdings"]:
                    if isinstance(row.get(key),str):
                        row[key]=json.loads(row[key])
            cleaned.append(classes[request.kind].model_validate(row))
        keys=[str(plain(m).get("key") or plain(m).get("code") or plain(m).get("date")) for m in cleaned]
        if len(keys)!=len(set(keys)):
            raise ValueError("本次导入包含重复键，请先合并核对")
        save(request.kind,cleaned,identity)
        sync.request_refresh()
        return {"ok":True,"count":len(cleaned)}

    @router.delete("/{kind}/{key}")
    def remove(kind: str,key: str,identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        if kind not in classes or kind=="account":
            raise HTTPException(status_code=404,detail="记录不存在")
        with factory() as db:
            row=db.scalar(select(InvestmentRecord).where(InvestmentRecord.user_id==identity[0],InvestmentRecord.project_id==identity[1],InvestmentRecord.kind==kind,InvestmentRecord.key==key))
            if row is None:
                raise HTTPException(status_code=404,detail="记录不存在")
            db.delete(row)
            db.commit()
        return {"ok":True}

    @router.post("/compare")
    def compare(request: Comparison,identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        data=demo_data() if request.demo else read(identity)
        return compare_products(parsed(data)[2],request)

    @router.get("/candidates")
    def recommend(category: Category="etf",peer: str="",demo: bool=False,identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        data=demo_data() if demo else read(identity)
        return candidates(*parsed(data),category,peer)

    @router.get("/review")
    def review(demo: bool=False,identity: tuple[int,int]=Depends(scope)) -> dict[str,Any]:
        data=demo_data() if demo else read(identity)
        points=[Valuation.model_validate(p) for p in data["valuations"]]
        if len(points)>=2:
            start,end=min(p.date for p in points),max(p.date for p in points)
            transactions=[Transaction.model_validate(t) for t in data["transactions"]]
            external=[t for t in transactions if t.kind in {"deposit","withdrawal"} and start<t.date<=end]
            if external:
                grouped: dict[date,Decimal]={}
                for t in external:
                    grouped[t.date]=grouped.get(t.date,Decimal(0))+(t.amount if t.kind=="deposit" else -t.amount)
                snapshots={p.date:p for p in points}
                if any(day not in snapshots or snapshots[day].flow!=flow for day,flow in grouped.items()):
                    raise ValueError("外部追加/提取记录与估值净流入不一致，或流入日缺少估值，请先对账")
        result=returns(points)
        result["liveValuation"]=live_valuation(data)
        result["reconciledThrough"]=max((str(p.date) for p in points),default=None)
        return result

    return router
