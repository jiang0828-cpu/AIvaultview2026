import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWorldProject, worldIssues, worldIssueData, exportWorldMarkdown, worldClaimRecords, worldEvidenceCalculation, worldSourceDate, type WorldEvidenceReview } from '../src/worldModel';
import { isProject } from '../src/projectNavigation';
import { filterProjects, readProjectFilters } from '../src/projectFilters';
import { worldReport } from '../../backend/prisma/world-data';
import { worldDataDocument } from '../../backend/prisma/world';
import { worldReport002 } from '../../backend/prisma/world-002-data';
import { worldDataDocument002 } from '../../backend/prisma/world-002';
import { worldReport003 } from '../../backend/prisma/world-003-data';
import { worldChapters003, worldDataDocument003 } from '../../backend/prisma/world-003';
import type { Content } from '../src/types';

function node(id: number, extra: Partial<Content> = {}): Content {
  return { id, title: 'Folder', type: 'folder', scene: 'system', topics: [], description: '', parentId: null, sortOrder: 0, children: [], coverUrl: null, fileUrl: null, hlsUrl: null, pdfUrl: null, imagesJson: null, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', ...extra };
}
test('world is a searchable system project without promoting ordinary folders', () => {
  const project = node(1, { title: '观天下', description: '<!-- WORLD_PROJECT -->', isProject: true });
  assert.ok(isWorldProject(project)); assert.ok(isProject(project));
  assert.equal(isWorldProject(node(2, { title: '观天下' })), false);
  assert.equal(isWorldProject({ ...project, scene: 'work' }), false);
  assert.equal(filterProjects([project], readProjectFilters(new URLSearchParams('q=观天下&scene=system'))).length, 1);
});
test('issue selection is scoped, deterministic and rejects missing or malformed data', () => {
  const data = node(5, { type: 'text', description: worldDataDocument.description });
  const one = node(2, { description: '<!-- WORLD_ISSUE -->', sortOrder: 1, children: [data] });
  const two = node(3, { description: '<!-- WORLD_ISSUE -->', sortOrder: 2 });
  const project = node(1, { children: [one, two, node(4)] });
  assert.deepEqual(worldIssues(project).map((item) => item.id), [3, 2]);
  assert.equal(worldIssueData(undefined), null); assert.equal(worldIssueData(two), null);
  assert.equal(worldIssueData(one)?.number, '001');
  assert.equal(worldIssueData({ ...one, children: [data, data] }), null);
  assert.equal(worldIssueData({ ...one, children: [{ ...data, description: '<!-- WORLD_DATA_V1 -->{}' }] }), null);
});
test('full report export retains edited text, data periods, scenarios and traceable sources', () => {
  const markdown = exportWorldMarkdown(worldReport, [node(1, { type: 'text', description: '人工修订章节' })]);
  for (const expected of ['人工修订章节', '2026年前三季度', '机构', '条件情景', '触发', 'https://www.ilo.org/']) {
    assert.ok(markdown.includes(expected), expected);
  }
  assert.ok(markdown.includes(worldReport.scenarios[0].invalidation));
  assert.ok(markdown.includes('机构预测'));
});

test('issue two retains the evidence labels and announced dates in the export', () => {
  const report = worldIssueData(node(176, { children: [node(177, { type: 'text', description: worldDataDocument002.description })] }));
  assert.deepEqual(report, worldReport002);
  const markdown = exportWorldMarkdown(report!, []);
  assert.match(markdown, /2026-11-09｜诉状已提交｜股东提交证券拟议集体诉讼/);
  assert.match(markdown, /2026-11-18｜已公告议程｜FY2027第三季度财报电话会/);
  assert.match(markdown, /客户与开发者：/);
  assert.doesNotMatch(exportWorldMarkdown(worldReport, []), /## 事件时间线/);
});

test('evidence export preserves computed inputs, origin grouping and falsification conditions', () => {
  const review: WorldEvidenceReview = {
    revisedOn: '2026-11-11', scope: '同口径样本', method: '先核对原始资料，再比较口径，最后检验结论。',
    records: [
      { id: 'now', title: '本期数量', kind: 'data', value: 60, unit: '个', period: '2026', basis: '全样本', origin: '原始统计A', sourceIds: ['NBS26'] },
      { id: 'before', title: '前期数量', kind: 'data', value: 40, unit: '个', period: '2025', basis: '全样本', origin: '原始统计A', sourceIds: ['NBS26'] },
      { id: 'report', title: '媒体转述', kind: 'allegation', period: '2026', basis: '没有独立复核', origin: '原始统计A', sourceIds: ['NBS26'] },
    ],
    calculations: [{ id: 'change', title: '数量增长率', operation: 'growth', left: 'now', right: 'before', unit: '%', decimals: 1, note: '前期为分母；不是百分点差。' }],
    claims: [{ id: 'claim', title: '数量增加', level: 'bounded', conclusion: '样本内数量增加，无法外推总体。', reasoning: '比较同口径数量。', counter: '样本覆盖可能变化。', verify: '核查覆盖范围是否一致。', recordIds: ['report'], calculationIds: ['change'] }],
  };
  const calculation = worldEvidenceCalculation(review.calculations[0], review);
  assert.equal(calculation.result, '50.0 %');
  assert.equal(calculation.formula, '(60 ÷ (40) − 1) × 100');
  assert.deepEqual(worldClaimRecords(review.claims[0], review).map((record) => record.id), ['now', 'before', 'report']);
  assert.equal(worldEvidenceCalculation({ ...review.calculations[0], operation: 'difference', unit: '个' }, review).result, '20.0 个');
  assert.equal(worldEvidenceCalculation({ ...review.calculations[0], operation: 'share' }, review).result, '150.0 %');
  const markdown = exportWorldMarkdown({ ...worldReport, evidenceReview: review }, []);
  for (const text of ['## 证据与论证', '60 ÷ (40)', '50.0 %', '输入：本期数量 [now]', '媒体转述｜未证实主张', '仅支持有限判断', '反证或替代解释：样本覆盖可能变化。', '验证条件：核查覆盖范围是否一致。', '源头组：原始统计A']) assert.ok(markdown.includes(text), text);
  assert.ok(markdown.indexOf('## 证据与论证') < markdown.indexOf('## 条件情景'));
  assert.doesNotMatch(exportWorldMarkdown({ ...worldReport, evidenceReview: undefined }, []), /## 证据与论证/);
});

test('response layer exports responsible actors, actionable steps, limits and evaluation before scenarios', () => {
  const response = { id: 'verify', title: '独立通道核验', actor: '财务负责人', objective: '阻断冒充付款',
    trigger: '陌生收款账户或紧急变更', actions: ['回拨已存联系人', '第二人核对账户后授权'],
    limitation: '不能单凭视频和声音确认身份', metric: '记录核验覆盖率和误拒率', sourceIds: ['NBS26'] };
  const markdown = exportWorldMarkdown({ ...worldReport, responses: [response] }, []);
  for (const text of ['## 应对措施', response.title, response.actor, response.trigger, ...response.actions, response.limitation, response.metric])
    assert.ok(markdown.includes(text), text);
  assert.ok(markdown.indexOf('## 应对措施') < markdown.indexOf('## 条件情景'));
  assert.doesNotMatch(exportWorldMarkdown(worldReport, []), /## 应对措施/);
});

test('third issue preserves six responses, full chapters and source precision in the downloadable report', () => {
  const issue = node(30, { description: '<!-- WORLD_ISSUE -->', children: [node(31, { ...worldDataDocument003, type: 'text', scene: 'system' })] });
  assert.deepEqual(worldIssueData(issue), worldReport003);
  const documents = worldChapters003.map((chapter, index) => node(32 + index, { ...chapter, type: 'text', scene: 'system' }));
  const markdown = exportWorldMarkdown(worldReport003, documents);
  assert.equal(worldReport003.responses?.length, 6);
  for (const response of worldReport003.responses!) {
    for (const value of [response.title, response.actor, response.trigger, ...response.actions, response.metric, response.limitation])
      assert.ok(markdown.includes(value), value);
  }
  for (const document of documents) assert.ok(markdown.includes(document.description));
  for (const takeaway of worldReport003.takeaways!) assert.ok(markdown.includes(takeaway.detail));
  const transmissionAt = markdown.lastIndexOf('## 传导机制');
  const responsesAt = markdown.lastIndexOf('## 应对措施');
  const scenariosAt = markdown.lastIndexOf('## 条件情景');
  assert.ok(transmissionAt >= 0 && transmissionAt < responsesAt);
  assert.ok(responsesAt < scenariosAt);
  const source = worldReport003.sources[0];
  assert.equal(worldSourceDate({ ...source, published: '2020-01-01', datePrecision: 'year' }), '发布：2020');
  assert.equal(worldSourceDate({ ...source, published: '2025-05-01', datePrecision: 'month' }), '发布：2025-05');
  assert.equal(worldSourceDate({ ...source, published: '2026-11-11', datePrecision: 'accessed' }), '查阅：2026-11-11');
});
