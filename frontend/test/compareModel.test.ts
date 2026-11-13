import test from 'node:test';
import assert from 'node:assert/strict';
import { nullLabel, priceLabel, sortOffers, isCompareProject, platformProductUrl, platformSearchUrl, offerDestination, unitPriceLabel, packLabel, providerStatuses, type CompareOffer } from '../src/compareModel';
import type { Content } from '../src/types';

const offer = (id: string, landedPrice: number | null, total: number | null, currency = 'CNY'): CompareOffer => ({
  id, platform: 'jd', externalId: id, title: id, url: null, brand: 'A', model: 'M', specs: {}, condition: 'new', itemPrice: landedPrice, shippingFee: null, taxFee: null, couponDiscount: null, serviceFee: null, subsidy: null, landedPrice, currency, priceStatus: landedPrice === null ? 'incomplete' : 'confirmed', sellerName: null, sellerRating: null, positiveRate: null, reviewCount: null, likes: null, shares: null, salesCount: null, deliveryDays: null, returnPolicy: null, sourceFetchedAt: new Date().toISOString(), source: 'test', dataCompleteness: 50, matchLevel: 'exact', eligible: true, reasons: [], risks: [], scores: { price: null, quality: null, seller: null, delivery: null, completeness: 50, heat: null, total },
});

test('comparison presentation keeps unknown numeric values unknown', () => {
  assert.equal(nullLabel(null), '未知');
  assert.equal(priceLabel({ landedPrice: null, currency: 'CNY', priceStatus: 'incomplete' }), '待确认');
  assert.equal(priceLabel({ landedPrice: 100, currency: 'CNY', priceStatus: 'estimated' }), '约 ¥100.00');
});

test('price sorting puts unknown prices last and score sorting is stable for null score', () => {
  assert.deepEqual(sortOffers([offer('unknown', null, null), offer('cheap', 80, 70), offer('expensive', 120, 90)], 'price').map(item => item.id), ['cheap', 'expensive', 'unknown']);
  assert.deepEqual(sortOffers([offer('unknown', null, null), offer('cheap', 80, 70), offer('expensive', 120, 90)]).map(item => item.id), ['expensive', 'cheap', 'unknown']);
});

test('platform links accept only the matching official HTTPS host', () => {
  assert.equal(platformProductUrl('jd', 'https://item.jd.com/123.html'), 'https://item.jd.com/123.html');
  assert.equal(platformProductUrl('pinduoduo', 'https://mobile.yangkeduo.com/goods.html?goods_id=123'), 'https://mobile.yangkeduo.com/goods.html?goods_id=123');
  for (const value of ['javascript:alert(1)', 'http://item.jd.com/1', 'https://jd.com.evil.test/1', 'https://eviljd.com/1', 'https://u:p@item.jd.com/1', 'https://item.jd.com:8443/1', 'https://www.ebay.com/itm/1'])
    assert.equal(platformProductUrl('jd', value), null, value);
});

test('demo links open platform searches without claiming to be original listings', () => {
  const demo = { ...offer('demo', 100, 90), url: 'https://example.com/fake', sourceMode: 'demo' as const, title: '[演示] Apple iPhone 16', model: 'iPhone 16' };
  assert.equal(offerDestination(demo)?.label, '平台搜索');
  assert.equal(new URL(offerDestination(demo)!.href).host, 'search.jd.com');
  const manual = { ...demo, sourceMode: 'manual' as const, title: '商品', url: 'https://item.jd.com/123.html' };
  assert.equal(offerDestination(manual)?.label, '原商品页');
  assert.equal(offerDestination({ ...manual, url: 'https://evil.test/' })?.label, '平台搜索');
  assert.equal(platformSearchUrl('jd', '牛奶 & 蛋'), 'https://search.jd.com/Search?keyword=%E7%89%9B%E5%A5%B6%20%26%20%E8%9B%8B');
});

test('unit prices remain grouped by currency and measurement dimension', () => {
  const rows = [
    { ...offer('kg-high', 100, 80), unitPrice: 20, comparisonUnit: 'kg' },
    { ...offer('litre', 20, 80), unitPrice: 1, comparisonUnit: 'l' },
    { ...offer('kg-low', 50, 80), unitPrice: 10, comparisonUnit: 'kg' },
    { ...offer('unknown', 30, 80), unitPrice: null, comparisonUnit: 'kg' },
    { ...offer('usd', 1, 80, 'USD'), unitPrice: 1, comparisonUnit: 'kg' },
  ];
  assert.deepEqual(sortOffers(rows, 'unitPrice').map(item => item.id), ['kg-low', 'kg-high', 'unknown', 'litre', 'usd']);
  assert.equal(unitPriceLabel(rows[0]), '¥20.00 / kg');
  assert.equal(unitPriceLabel(rows[3]), '单位价待确认');
  assert.equal(packLabel({ packCount: 12, netWeight: 250, unit: 'ml' }), '250ml × 12 包/瓶');
  assert.equal(packLabel({ packCount: null, netWeight: 250, unit: 'ml' }), '包装规格待确认');
});

test('historical malformed currencies do not crash money formatting', () => {
  assert.equal(priceLabel(offer('bad', 30, 80, '12!')), '30.00（币种待确认）');
  assert.equal(unitPriceLabel({ unitPrice: 10, comparisonUnit: 'kg', currency: '$$$' }), '10.00（币种待确认） / kg');
});

test('provider status mapping retains platform identity when omitted upstream', () => {
  assert.deepEqual(providerStatuses({ jd: { platform: '', status: 'unavailable' } }), [{ platform: 'jd', status: 'unavailable' }]);
});

test('project detection requires the explicit marker and life scene', () => {
  const base: Content = {
    id: 1,
    title: '价格比较',
    type: 'folder',
    isProject: true,
    scene: 'life',
    topics: ['消费'],
    description: '<!-- PRICE_COMPARE_PROJECT -->',
    coverUrl: null,
    fileUrl: null,
    hlsUrl: null,
    pdfUrl: null,
    imagesJson: null,
    sortOrder: 0,
    parentId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  assert.equal(isCompareProject(base), true);
  assert.equal(isCompareProject({ ...base, scene: 'work' }), false);
  assert.equal(isCompareProject({ ...base, description: '消费支出' }), false);
});
