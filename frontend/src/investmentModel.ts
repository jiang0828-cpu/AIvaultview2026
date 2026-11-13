import type { Content } from './types';

export const isInvestmentProject = (item: Content | null | undefined): item is Content => Boolean(item?.isProject && item.type === 'folder' && item.scene === 'life' && item.description.includes('<!-- INVESTMENT_WORKBENCH -->'));
export const investmentCategories = [['etf', 'ETF'], ['equity_fund', '主动权益基金'], ['bond_fund', '债券基金'], ['money_fund', '货币基金'], ['stock', '股票观察'], ['bond', '债券观察']] as const;
export type InvestmentCategory = typeof investmentCategories[number][0];
export type Dataset = 'products' | 'positions' | 'transactions' | 'valuations';
export interface InvestmentAccount {
  cash: number | string; liabilities: number | string; emergency: number | string; expense1y: number | string;
  expense3y: number | string; monthly: number | string; horizon: number; lossAmount: number | string;
  maxDrawdown: number; riskLevel: number; updatedOn: string;
}
export interface InvestmentProduct {
  dataCode?: string | null; autoUpdate?: boolean; market?: InvestmentMarket | null;
  code: string; name: string; category: InvestmentCategory; peer: string; shareClass: string; riskLevel: number; minMonths: number;
  annualReturn: number | null; drawdown: number | null; managementFee: number | null; custodyFee: number | null;
  salesFee: number | null; subscriptionFee: number | null; redemptionFee: number | null; trackingError: number | null;
  premium: number | null; turnover: number | string | null; duration: number | null; credit: string | null;
  managerTenure: number | null; returnPeriod: string; liquidity: string; restrictions: string; logic: string; risks: string;
  reassess: string; active: boolean; sourceUrl: string; sourceName: string; asOf: string; publishedAt: string; fetchedAt: string;
  exposures: Record<string, number>; holdings: Record<string, number>; demo: boolean;
}
export interface InvestmentPosition { code: string; name: string; category: InvestmentCategory; units: string; price: string; cost: string; asOf: string }
export interface InvestmentTransaction { key: string; date: string; code: string; kind: string; amount: string; fee: string; note: string }
export interface InvestmentValuation { date: string; value: string; flow: string; fixedBenchmark: string | null; simpleBenchmark: string | null }
export interface InvestmentState {
  demo: boolean; account: InvestmentAccount; products: InvestmentProduct[]; positions: InvestmentPosition[];
  transactions: InvestmentTransaction[]; valuations: InvestmentValuation[];
  summary: { cash: number; invested: number; netAssets: number; reserved: number; available: number; existingStress: number; remainingLossBudget: number; warnings: string[]; exposures: Record<string, number>; ready: boolean };
  providers: { name: string; status: string }[];
  sync: { enabled: boolean; configured: boolean; realtimeEnabled: boolean; intervalSeconds: number; lastCycleAt: string | null; serviceError: string | null;
    accountSync: string; channels: { name: string; url: string; status: string; checkedAt: string | null; note?: string }[] };
  liveValuation: InvestmentLiveValuation;
}
export interface InvestmentMarket {
  providerCode: string; status: 'ready' | 'stale' | 'blocked' | 'error' | 'pending'; reason: string;
  kind: 'close' | 'nav' | 'realtime'; price: string | null; priceDate: string | null; fetchedAt: string | null;
  sourceTime: string | null; publishedOn: string | null; sourceUrl: string; expectedDate: string | null;
  navFetchedAt?: string | null; feesFetchedAt?: string | null;
  return1y: number | null; drawdown1y: number | null; period: string; warnings: string[];
}
export interface InvestmentLiveValuation { ready: boolean; value: number | null; missingCodes: string[]; priceDates: string[]; cashAsOf: string; message: string }
export interface Candidate {
  product: InvestmentProduct; score: number; reasons: string[]; logic: string; risks: string; overlap: string[];
  reassess: string; stressPercent: number; researchCeiling: number; sizingNote: string;
}
export interface InvestmentCandidates { candidates: Candidate[]; excluded: { code: string; name: string; reasons: string[] }[]; message: string }
export interface InvestmentComparison { rows: { product: InvestmentProduct; illustrativeCost: number | null; issues: string[] }[]; amount: number; months: number; costBasis: string }
export interface InvestmentReview {
  ready: boolean; message: string; profit?: number; netFlow?: number; twr?: number; xirr?: number | null; maxDrawdown?: number;
  curve?: { date: string; value: number; strategy: number }[]; benchmarks?: Record<string, number | null>;
  liveValuation?: InvestmentLiveValuation; reconciledThrough?: string | null;
}
export const money = (value: number | string | null | undefined) => value == null || !Number.isFinite(Number(value)) ? '待补充' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(Number(value));
export const percent = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '待补充' : `${value.toFixed(2)}%`;
export const categoryName = (category: string) => investmentCategories.find(([key]) => key === category)?.[1] || category;
export function investmentSource(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') ? url.href : null; }
  catch { return null; }
}
export function sameInvestmentGroup(products: InvestmentProduct[]) {
  return products.length > 0 && products.every(p => p.category === products[0].category && p.peer === products[0].peer);
}
export const investmentChannels = [
  { name: '天天基金官方', url: 'https://www.1234567.com.cn/', type: '基金渠道', note: '核对代码、份额类别、申赎费、限购与到账；以购买时页面为准。' },
  { name: '华泰证券官方', url: 'https://www.htsc.com.cn/', type: '证券渠道', note: '仅限本人已开户并具备资格的账户；场内ETF、股票需核对市场和交易单位。' },
  { name: '上交所 ETF', url: 'https://www.sse.com.cn/assortment/fund/etf/home/', type: '研究披露', note: '交易所资料入口，不是购买页。核对基金公告、交易费用与规则。' },
  { name: '巨潮资讯', url: 'https://www.cninfo.com.cn/', type: '公告核验', note: '核对公司与基金公告、实际披露日期，不是购买入口。' },
  { name: '中债收益率曲线', url: 'https://yield.chinabond.com.cn/', type: '债券参考', note: '曲线仅供研究，非具体债券可成交收益率；购买使用本人银行或券商。' },
];

export function importExample(kind: Dataset): Record<string, unknown>[] {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const prior = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  if (kind === 'positions') return [{ code: 'YOURCODE', name: '请替换为实际持仓', category: 'etf', units: 100, price: 1, cost: 100, asOf: day }];
  if (kind === 'transactions') return [{ key: 'trade-001', date: day, code: 'YOURCODE', kind: 'buy', amount: 100, fee: 1, note: '请替换为实际成交；仅记录，不自动改变现金与份额' }];
  if (kind === 'valuations') return [{ date: prior, value: 10000, flow: 0, fixedBenchmark: null, simpleBenchmark: null }, { date: day, value: 11000, flow: 1000, fixedBenchmark: null, simpleBenchmark: null }];
  return [{ code: 'YOURCODE', dataCode: null, autoUpdate: true, name: '请替换为真实产品与来源', category: 'etf', peer: '请填写跟踪指数', shareClass: '场内', riskLevel: 3, minMonths: 60,
    annualReturn: null, drawdown: null, managementFee: null, custodyFee: null, salesFee: null, subscriptionFee: null, redemptionFee: null,
    trackingError: null, premium: null, turnover: null, logic: '', risks: '', reassess: '', liquidity: '', restrictions: '',
    sourceName: '请填写已核实来源', sourceUrl: 'https://www.sse.com.cn/', asOf: day, publishedAt: now.toISOString(), fetchedAt: now.toISOString(), exposures: {}, holdings: {} }];
}
