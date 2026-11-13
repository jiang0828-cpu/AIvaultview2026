from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from price_compare.config import Settings
from price_compare.investment import Account, Comparison, Position, Product, Valuation, candidates, compare_products, demo_data, portfolio, product_issues, returns
from price_compare.main import create_app


def product(**changes):
    data=demo_data()["products"][0]
    data.update(changes)
    return Product.model_validate(data)


def account(**changes):
    data=demo_data()["account"]
    data.update(changes)
    return Account.model_validate(data)


def test_reserves_do_not_include_future_monthly_income():
    summary=portfolio(account(cash=100000,liabilities=10000,emergency=20000,expense1y=10000,expense3y=15000,monthly=99999),[],[])
    assert summary["available"]==45000
    assert summary["netAssets"]==90000


@pytest.mark.parametrize("changes",[{"lossAmount":0},{"cash":1000},{"updatedOn":date.today()-timedelta(days=31)},{"horizon":1},{"riskLevel":1},{"maxDrawdown":1}])
def test_funding_risk_and_horizon_gate(changes):
    result=candidates(account(**changes),[],[product()],"etf","示例宽基指数")
    assert not result["candidates"]


@pytest.mark.parametrize("changes",[{"shareClass":"未确认"},{"subscriptionFee":None},{"drawdown":None},{"trackingError":None},{"premium":2},{"turnover":None},{"logic":""},{"active":False},{"asOf":date.today()-timedelta(days=8)}])
def test_missing_stale_or_invalid_products_not_recommended(changes):
    assert not candidates(account(),[],[product(**changes)],"etf","示例宽基指数")["candidates"]


def test_same_class_group_and_deterministic_top_three():
    products=[Product.model_validate(p) for p in demo_data()["products"]]
    result=candidates(account(),[],products,"etf","示例宽基指数")
    assert len(result["candidates"])==3
    assert result["candidates"][0]["product"]["code"]=="DEMO01"
    assert candidates(account(),[],products,"stock","股票观察")["candidates"]==[]
    with pytest.raises(ValueError,match="同类"):
        compare_products(products,Comparison(codes=["DEMO01","DEMO05"]))


def test_fee_illustration_and_unknown_is_not_zero():
    result=compare_products([product()],Comparison(codes=["DEMO01"],amount=10000,months=12))
    assert result["rows"][0]["illustrativeCost"]==20
    missing=compare_products([product(custodyFee=None)],Comparison(codes=["DEMO01"]))
    assert missing["rows"][0]["illustrativeCost"] is None


def test_existing_portfolio_consumes_loss_budget_and_reports_overlap():
    p=product()
    position=Position(code=p.code,name=p.name,category="etf",units=100,price=100,cost=10000,asOf=date.today())
    result=candidates(account(lossAmount=4000),[position],[p],"etf",p.peer)
    assert result["candidates"][0]["researchCeiling"]==pytest.approx(1000/.3,abs=.01)
    assert "同一基准" in result["candidates"][0]["overlap"][0]
    assert not candidates(account(lossAmount=2000),[position],[p],"etf",p.peer)["candidates"]


def test_stale_position_blocks_candidates_and_unknown_exposure_is_visible():
    position=Position(code="UNKNOWN",name="待补",category="etf",units=100,price=10,cost=1000,asOf=date.today()-timedelta(days=8))
    result=portfolio(account(),[position],[product()])
    assert not result["ready"]
    assert result["exposures"]["未穿透"]==1000


def test_stale_underlying_profile_and_conflicting_category_block_portfolio():
    position=Position(code="DEMO01",name="持仓",category="etf",units=100,price=10,cost=1000,asOf=date.today())
    for p in [product(asOf=date.today()-timedelta(days=8)),product(category="stock")]:
        assert not portfolio(account(),[position],[p])["ready"]


@pytest.mark.parametrize("url",["javascript:alert(1)","http://sse.com.cn/","https://name:pass@sse.com.cn/","https://sse.com.cn:8000/"])
def test_unsafe_sources_rejected(url):
    with pytest.raises(ValidationError):
        product(sourceUrl=url)


def test_bad_weights_nonfinite_and_disclosure_order_rejected():
    for changes in [{"exposures":{"行业":101}},{"holdings":{"股票甲":60,"股票乙":60}},{"managementFee":float("nan")},
                    {"publishedAt":datetime.now(timezone.utc)+timedelta(days=1)}, {"asOf":date.today()+timedelta(days=1)}]:
        with pytest.raises(ValidationError):
            product(**changes)


def test_deposits_are_not_profit_and_twr_is_not_double_deducted():
    points=[Valuation(date="2025-01-01",value=10000),Valuation(date="2026-01-01",value=12000,flow=1000)]
    result=returns(points)
    assert result["profit"]==1000
    assert result["netFlow"]==1000
    assert result["twr"]==10
    assert result["xirr"]==10
    assert result["benchmarks"]["fixedBenchmark"] is None


def test_withdrawal_and_sample_drawdown():
    result=returns([Valuation(date="2025-01-01",value=10000),Valuation(date="2025-06-01",value=8000,flow=-1000),Valuation(date="2026-01-01",value=9000)])
    assert result["profit"]==0
    assert result["maxDrawdown"]==10
    assert result["twr"]==1.25
    assert result["xirr"]==0


def test_return_validation_and_benchmark_start():
    assert not returns([])["ready"]
    for points in [
        [Valuation(date="2025-01-01",value=100,flow=100),Valuation(date="2026-01-01",value=110)],
        [Valuation(date="2025-01-01",value=100),Valuation(date="2025-01-01",value=110)],
        [Valuation(date="2025-01-01",value=100),Valuation(date="2026-01-01",value=110,flow=200)],
        [Valuation(date="2025-01-01",value=100,fixedBenchmark=1000),Valuation(date="2026-01-01",value=110,fixedBenchmark=1100)],
    ]:
        with pytest.raises(ValueError):
            returns(points)


def test_multiple_xirr_sign_changes_not_silently_reported_as_unique():
    result=returns([Valuation(date="2025-01-01",value=100),Valuation(date="2025-04-01",value=100,flow=-200),Valuation(date="2025-08-01",value=400,flow=100),Valuation(date="2026-01-01",value=300)])
    assert result["xirr"] is None


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(Settings(database_url=f"sqlite:///{tmp_path/'invest.db'}",internal_token="test-investment-token")))


def headers(user=1,project=10):
    return {"Authorization":"Bearer test-investment-token","X-User-Id":str(user),"X-Project-Id":str(project)}


def test_api_internal_auth_isolation_and_demo_does_not_write(client):
    assert client.get('/investment/state').status_code==401
    assert client.get('/investment/state?demo=true',headers=headers()).json()["products"]
    assert client.get('/investment/state',headers=headers()).json()["products"]==[]
    p=product(code="510001",demo=False).model_dump(mode="json")
    assert client.post('/investment/import',headers=headers(),json={"kind":"products","format":"json","data":[p]}).status_code==200
    assert len(client.get('/investment/state',headers=headers()).json()["products"])==1
    for scope in [headers(2),headers(1,20)]:
        assert client.get('/investment/state',headers=scope).json()["products"]==[]
        assert client.delete('/investment/products/510001',headers=scope).status_code==404


def test_import_is_atomic_idempotent_and_rejects_duplicate_keys(client):
    p=product(code="510001",demo=False).model_dump(mode="json")
    body={"kind":"products","format":"json","data":[p,{**p,"code":"NEW","riskLevel":99}]}
    assert client.post('/investment/import',headers=headers(),json=body).status_code==400
    assert not client.get('/investment/state',headers=headers()).json()["products"]
    body["data"]=[p,p]
    assert client.post('/investment/import',headers=headers(),json=body).status_code==400
    body["data"]=[p]
    for _ in range(2):
        assert client.post('/investment/import',headers=headers(),json=body).status_code==200
    state=client.get('/investment/state',headers=headers()).json()
    assert len(state["products"])==1
    assert state["products"][0]["demo"] is False


def test_demo_product_cannot_be_imported_into_real_research(client):
    result=client.post('/investment/import',headers=headers(),json={"kind":"products","format":"json","data":[demo_data()["products"][0]]})
    assert result.status_code==400
    assert not client.get('/investment/state',headers=headers()).json()["products"]


def test_csv_positions_account_and_review_flow_reconciliation(client):
    csv="code,name,category,units,price,cost,asOf\nABC,持仓,etf,100,2,180,"+str(date.today())
    assert client.post('/investment/import',headers=headers(),json={"kind":"positions","format":"csv","data":csv}).status_code==200
    assert client.put('/investment/account',headers=headers(),json={"cash":5000}).status_code==200
    assert client.get('/investment/state',headers=headers()).json()["summary"]["invested"]==200
    for kind,data in [("valuations",[{"date":"2025-01-01","value":10000},{"date":"2026-01-01","value":11000}]),
                      ("transactions",[{"key":"deposit","date":"2025-06-01","kind":"deposit","amount":1000}])]:
        assert client.post('/investment/import',headers=headers(),json={"kind":kind,"format":"json","data":data}).status_code==200
    result=client.get('/investment/review',headers=headers())
    assert result.status_code==400
    assert "对账" in result.json()["error"]["message"]


def test_demo_review_and_compare_work_through_real_routes(client):
    assert client.get('/investment/review?demo=true',headers=headers()).json()["profit"]==4000
    result=client.post('/investment/compare',headers=headers(),json={"codes":["DEMO01","DEMO02"],"demo":True,"amount":10000,"months":12})
    assert result.status_code==200
    assert result.json()["rows"][0]["illustrativeCost"]==20
    assert product_issues(product())==[]
    assert Decimal(str(result.json()["amount"]))==10000
