import type { Content } from './types';

export function isCompareProject(content: Content | null | undefined): content is Content {
  return Boolean(content?.isProject && content.type === 'folder' && content.scene === 'life' && content.description.includes('<!-- PRICE_COMPARE_PROJECT -->'));
}

export type CompareCondition = "new" | "used" | "refurbished";
export type MatchLevel = "exact" | "near" | "similar";
export type CompareCategory = 'standard' | 'food' | 'drink' | 'household';
export type CompareSort = 'score' | 'price' | 'unitPrice' | 'platform';

export interface CompareScores {
  price: number | null;
  quality: number | null;
  seller: number | null;
  delivery: number | null;
  completeness: number | null;
  heat: number | null;
  total: number | null;
}

export interface CompareOffer {
  id: number | string;
  platform: string;
  externalId: string;
  title: string;
  url: string | null;
  brand: string | null;
  model: string | null;
  category?: CompareCategory | null;
  packCount?: number | null;
  netWeight?: number | null;
  unit?: string | null;
  totalQuantity?: number | null;
  comparisonUnit?: string | null;
  unitPrice?: number | null;
  expiresOn?: string | null;
  specs: Record<string, string | number | boolean | null>;
  condition: CompareCondition | "unknown";
  itemPrice: number | null;
  shippingFee: number | null;
  taxFee: number | null;
  couponDiscount: number | null;
  serviceFee?: number | null;
  subsidy?: number | null;
  landedPrice: number | null;
  currency: string;
  priceStatus: "confirmed" | "estimated" | "incomplete";
  sellerName: string | null;
  sellerRating: number | null;
  positiveRate: number | null;
  reviewCount: number | null;
  likes: number | null;
  shares: number | null;
  salesCount: number | null;
  deliveryDays: number | null;
  returnPolicy: string | null;
  sourceFetchedAt: string;
  source: string;
  sourceMode?: "demo" | "manual" | "api" | "live";
  dataCompleteness: number;
  matchLevel: MatchLevel;
  eligible: boolean;
  reasons: string[];
  risks: string[];
  scores: CompareScores;
}

export interface ProviderStatus {
  platform: string;
  status: string;
  reason?: string;
  fallback?: string;
  automaticSearch?: boolean;
}

export interface CompareSearchResponse {
  runId: string;
  status: string;
  request: Record<string, unknown>;
  summary: {
    matchedCount: number;
    exactMatchCount: number;
    providerStatus?: Record<string, ProviderStatus> | ProviderStatus[];
  };
  offers: CompareOffer[];
  recommendations: Array<CompareOffer & { rank: number }>;
}

export interface CompareRunSummary {
  runId: string;
  query: string;
  createdAt: string;
  mode: string;
  exactMatchCount: number;
}

export function priceLabel(offer: Pick<CompareOffer, "landedPrice" | "currency" | "priceStatus">) {
  if (offer.landedPrice === null || !Number.isFinite(offer.landedPrice)) return "待确认";
  const value = formatCurrency(offer.landedPrice, offer.currency);
  return offer.priceStatus === "confirmed" ? value : `约 ${value}`;
}

function formatCurrency(value: number, currency: string): string {
  if (!/^[A-Z]{3}$/i.test(currency)) return `${value.toFixed(2)}（币种待确认）`;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(value);
}

export function nullLabel(value: number | string | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "未知";
  return `${value}${suffix}`;
}

export function sortOffers(offers: CompareOffer[], mode: CompareSort = "score") {
  return [...offers].sort((a, b) => {
    if (mode === "platform") return a.platform.localeCompare(b.platform) || a.title.localeCompare(b.title);
    // Group currencies and measurement dimensions before comparing numeric prices.
    if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
    if (mode === 'unitPrice') {
      const unitOrder = (a.comparisonUnit || '~').localeCompare(b.comparisonUnit || '~');
      if (unitOrder) return unitOrder;
      return (a.unitPrice ?? Number.POSITIVE_INFINITY) - (b.unitPrice ?? Number.POSITIVE_INFINITY) || a.title.localeCompare(b.title);
    }
    if (mode === "price") {
      if (a.landedPrice === null && b.landedPrice === null) return a.title.localeCompare(b.title);
      if (a.landedPrice === null) return 1;
      if (b.landedPrice === null) return -1;
      return a.landedPrice - b.landedPrice;
    }
    return (b.scores.total ?? -1) - (a.scores.total ?? -1) || (a.landedPrice ?? Number.POSITIVE_INFINITY) - (b.landedPrice ?? Number.POSITIVE_INFINITY);
  });
}

export function providerStatuses(value: CompareSearchResponse["summary"]["providerStatus"]): ProviderStatus[] {
  if (!value) return [];
  return Array.isArray(value) ? value : Object.entries(value).map(([platform, item]) => ({ ...item, platform: item.platform || platform }));
}

const platformDomains: Record<string, string[]> = {
  jd: ['jd.com', 'jd.hk'],
  ebay: ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.com.au', 'ebay.ca', 'ebay.fr', 'ebay.it', 'ebay.es'],
  goofish: ['goofish.com', '2.taobao.com'],
  douyin: ['douyin.com', 'jinritemai.com'],
  pinduoduo: ['pinduoduo.com', 'yangkeduo.com'],
};

export function platformProductUrl(platform: string, value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    const allowed = platformDomains[platform] || [];
    return allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}

export function platformSearchUrl(platform: string, query: string): string | null {
  const encoded = encodeURIComponent(query.trim().slice(0, 200));
  return ({
    jd: `https://search.jd.com/Search?keyword=${encoded}`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${encoded}`,
    goofish: `https://www.goofish.com/search?q=${encoded}`,
    douyin: `https://www.douyin.com/search/${encoded}`,
    pinduoduo: `https://mobile.yangkeduo.com/search_result.html?search_key=${encoded}`,
  } as Record<string, string>)[platform] || null;
}

export function offerDestination(offer: Pick<CompareOffer, 'sourceMode' | 'title' | 'platform' | 'url' | 'model'>) {
  const demo = offer.sourceMode === 'demo' || /^\[演示\]/.test(offer.title);
  const product = demo ? null : platformProductUrl(offer.platform, offer.url);
  const href = product || platformSearchUrl(offer.platform, offer.model || offer.title.replace(/^\[演示\]\s*/, ''));
  return href ? { href, label: product ? '原商品页' : '平台搜索', isSearch: !product } : null;
}

export function unitPriceLabel(offer: Pick<CompareOffer, 'unitPrice' | 'comparisonUnit' | 'currency'>): string {
  if (offer.unitPrice == null || !Number.isFinite(offer.unitPrice) || !offer.comparisonUnit) return '单位价待确认';
  const unit = offer.comparisonUnit === 'piece' ? '件' : offer.comparisonUnit;
  return `${formatCurrency(offer.unitPrice, offer.currency)} / ${unit}`;
}

export function packLabel(offer: Pick<CompareOffer, 'packCount' | 'netWeight' | 'unit'>): string {
  return offer.packCount != null && offer.netWeight != null && offer.unit
    ? `${offer.netWeight}${offer.unit === 'piece' ? '件' : offer.unit} × ${offer.packCount} 包/瓶`
    : '包装规格待确认';
}
