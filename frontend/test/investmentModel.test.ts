import test from 'node:test';
import assert from 'node:assert/strict';
import { importExample, investmentChannels, investmentSource, isInvestmentProject, money, percent, sameInvestmentGroup, type InvestmentProduct } from '../src/investmentModel';
import type { Content } from '../src/types';

test('investment project requires explicit marker and project/life identity', () => {
  const item = { isProject: true, type: 'folder', scene: 'life', description: '<!-- INVESTMENT_WORKBENCH -->' } as Content;
  assert.equal(isInvestmentProject(item), true);
  assert.equal(isInvestmentProject({ ...item, scene: 'work' }), false);
  assert.equal(isInvestmentProject({ ...item, isProject: false }), false);
  assert.equal(isInvestmentProject({ ...item, description: '投资理财' }), false);
});
test('money and rates retain unknown rather than showing zero', () => {
  assert.equal(money(null), '待补充');
  assert.equal(money('NaN'), '待补充');
  assert.equal(money(0), '¥0.00');
  assert.equal(percent(null), '待补充');
  assert.equal(percent(0), '0.00%');
});
test('product research sources reject unsafe protocol credentials and ports', () => {
  for (const url of ['javascript:alert(1)', 'http://sse.com.cn/', 'https://u:p@sse.com.cn/', 'https://sse.com.cn:123/']) assert.equal(investmentSource(url), null);
  assert.equal(investmentSource('https://www.sse.com.cn/'), 'https://www.sse.com.cn/');
  for (const channel of investmentChannels) assert.ok(investmentSource(channel.url));
});
test('cross category and different benchmark products cannot form a comparison group', () => {
  const p = { category: 'etf', peer: '指数甲' } as InvestmentProduct;
  assert.equal(sameInvestmentGroup([p, { ...p }]), true);
  assert.equal(sameInvestmentGroup([p, { ...p, peer: '指数乙' }]), false);
  assert.equal(sameInvestmentGroup([p, { ...p, category: 'stock' }]), false);
  assert.equal(sameInvestmentGroup([]), false);
});
test('templates are editable examples and do not fabricate real research metrics', () => {
  const product = importExample('products')[0];
  assert.equal(product.drawdown, null);
  assert.equal(product.annualReturn, null);
  assert.match(String(product.code), /YOUR/);
  assert.equal(importExample('valuations')[0].flow, 0);
  assert.equal(importExample('valuations')[0].fixedBenchmark, null);
  assert.equal(importExample('positions').length, 1);
  assert.equal(importExample('transactions')[0].kind, 'buy');
});
