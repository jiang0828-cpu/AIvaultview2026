import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefDate, exportBriefHtml, exportBriefMarkdown, isBriefScheduleOverdue, isPrecisionBriefProject, precisionSections, searchBriefSources, sourcesForItem } from '../src/precisionBriefModel';
import type { BriefRun } from '../src/precisionBriefModel';
import type { Content } from '../src/types';
import { folderNavigationPath } from '../src/projectNavigation';

const run: BriefRun = {
  id: 1, projectId: 8, runKey: 'test-2026-11-11', issueDate: '2026-11-11', firstIssue: false, isCurrent: true,
  windowStart: '2026-11-10T01:00:00Z', windowEnd: '2026-11-11T01:00:00Z', status: 'published',
  summary: '公司与行业的新进展。', publishedAt: '2026-11-11T01:10:00Z', errorMessage: '',
  createdAt: '2026-11-11T01:00:00Z', updatedAt: '2026-11-11T01:10:00Z', validation: {}, tasks: [],
  items: [{ id: 5, section: 'company', title: '新检测产品<发布>', message: '披露验证结果。', attention: '关注样本规模与适用人群。', commentary: '需对照证据评估业务适用范围。', severity: 'important', sourceIds: ['S1'], sortOrder: 0 }],
  sources: [{ id: 3, key: 'S1', title: '企业产品公告', publisher: '发布机构', publishedAt: '2026-11-10', accessedAt: '2026-11-11T01:00:00Z', url: 'https://publisher.cn/news/1', sourceType: 'official', verified: true }],
};

test('precision brief project identity remains independent of market research projects', () => {
  const project = { id: 8, isProject: true, type: 'folder', scene: 'work', description: '<!-- PRECISION_BRIEF_PROJECT -->' } as Content;
  assert.ok(isPrecisionBriefProject(project));
  for (const wrong of [{ ...project, scene: 'life' }, { ...project, isProject: false }, { ...project, description: '<!-- MARKET_RESEARCH_PROJECT -->' }]) assert.equal(isPrecisionBriefProject(wrong as Content), false);
  assert.equal(folderNavigationPath([project], project), '/home?project=8');
});

test('five sections and Chinese source dates preserve topic and source identities', () => {
  assert.deepEqual(precisionSections.map(section => section.key), ['company', 'competitors', 'regulation', 'science', 'partners']);
  assert.equal(sourcesForItem(run.items[0], run.sources)[0].id, 3);
  assert.equal(searchBriefSources(run.sources, '发布机构').length, 1);
  assert.equal(searchBriefSources(run.sources, '不存在').length, 0);
  assert.equal(briefDate('2026-11-10'), '2026/11/10');
  assert.equal(briefDate('2026-11-10T18:00:00Z'), '2026/11/11');
});

test('schedule delay uses Beijing 09:00 and window cutoff rather than client timezone', () => {
  const yesterday = { windowEnd: '2026-11-11T01:00:00Z' };
  assert.equal(isBriefScheduleOverdue(yesterday, Date.parse('2026-11-12T00:59:59Z')), false);
  assert.equal(isBriefScheduleOverdue(yesterday, Date.parse('2026-11-12T01:00:00Z')), true);
  assert.equal(isBriefScheduleOverdue({ windowEnd: '2026-11-12T01:00:00Z' }, Date.parse('2026-11-12T02:00:00Z')), false);
  assert.equal(isBriefScheduleOverdue(null, Date.parse('2026-11-12T02:00:00Z')), true);
  assert.equal(isBriefScheduleOverdue(null, Date.parse('2026-11-11T17:00:00Z')), false);
});

test('Markdown and HTML downloads retain all messages, business comments, dates, sources and no-news sections', () => {
  const markdown = exportBriefMarkdown(run), html = exportBriefHtml(run);
  for (const value of [run.items[0].message, run.items[0].attention, run.items[0].commentary, run.sources[0].url, run.summary]) {
    assert.ok(markdown.includes(value)); assert.ok(html.includes(value));
  }
  for (const section of precisionSections) { assert.ok(markdown.includes(section.title)); assert.ok(html.includes(section.title)); }
  assert.equal((markdown.match(/本时窗未发现经核实新增/g) ?? []).length, 4);
  assert.ok(markdown.includes('⚠'));
  assert.ok(html.includes('新检测产品&lt;发布&gt;'));
  assert.ok(!html.includes('新检测产品<发布>'));
  assert.ok(html.includes('lang="zh-CN"'));
  assert.ok(markdown.includes('发布 2026/11/10 · 访问 2026/11/11'));
});
