import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exportLivelihoodMarkdown, formatLivelihoodCitations, isLivelihoodProject, livelihoodIssueDocuments, livelihoodIssueReport, livelihoodIssues, livelihoodSummary } from '../src/livelihoodModel';
import { livelihoodIssue001, livelihoodDataDocument001, livelihoodChapters001 } from '../../backend/prisma/livelihood-001';
import { livelihoodReport001 } from '../../backend/prisma/livelihood-001-data';
import { folderNavigationPath } from '../src/projectNavigation';
import { livelihoodProject, livelihoodDocuments } from '../../backend/prisma/livelihood';
import { livelihoodIssueMarker } from '../../backend/src/livelihoodSchema';
import type { Content } from '../src/types';

function node(id: number, value: Partial<Content> = {}): Content {
  return { id, title: '目录', type: 'folder', scene: 'system', isProject: false, topics: [], description: '',
    coverUrl: null, fileUrl: null, hlsUrl: null, pdfUrl: null, imagesJson: null, sortOrder: 0,
    parentId: null, createdAt: '2026-11-11T00:00:00Z', updatedAt: '2026-11-11T00:00:00Z', ...value };
}

test('download evidence mapping renders as one complete GFM table', () => {
  const documents = livelihoodChapters001.map((chapter, index) => node(index + 1, chapter));
  for (const chapters of [[], documents]) {
    const markdown = exportLivelihoodMarkdown(livelihoodReport001, chapters);
    const evidence = markdown.split('## 证据对应表\n\n')[1].split('\n\n## 资料来源与支持范围')[0];
    const html = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], children: evidence }));
    assert.equal((html.match(/<table>/g) ?? []).length, 1);
    assert.equal((html.match(/<th>/g) ?? []).length, 2);
    assert.equal((html.match(/<tr>/g) ?? []).length, 36);
    assert.ok(html.includes('章节或工作表条目'));
    assert.ok(html.includes(livelihoodReport001.helpChannels[1].title));
  }
});

test('livelihood identity and summaries distinguish projects from ordinary folders', () => {
  const project = node(1, { ...livelihoodProject, type: 'folder', scene: 'system' });
  assert.equal(isLivelihoodProject(project), true);
  assert.equal(isLivelihoodProject({ ...project, isProject: false }), false);
  assert.equal(isLivelihoodProject({ ...project, scene: 'life' }), false);
  assert.ok(!livelihoodSummary(project).includes('<!--'));
  assert.ok(livelihoodSummary(project).includes('一期一主题'));
  assert.equal(livelihoodIssues(project).length, 0);
  assert.ok(livelihoodDocuments.some((document) => document.description.includes(livelihoodIssueMarker)));
});

test('issue data and edited chapters remain scoped to the selected issue and export completely', () => {
  const issue = node(10, { ...livelihoodIssue001, children: [node(11, { ...livelihoodDataDocument001 }), ...livelihoodChapters001.map((chapter, index) => node(12 + index, { ...chapter }))] });
  const report = livelihoodIssueReport(issue)!;
  assert.deepEqual(report, livelihoodReport001);
  assert.equal(livelihoodIssueReport(node(20)), null);
  assert.equal(livelihoodIssueReport({ ...issue, children: [...issue.children!, node(25, { ...livelihoodDataDocument001 })] }), null);
  const documents = livelihoodIssueDocuments(issue, report);
  assert.equal(documents.length, 4);
  const edited = documents.map((document, index) => index === 0 ? { ...document, description: '管理员核验后补充的现状正文' } : document);
  const markdown = exportLivelihoodMarkdown(report, edited);
  assert.ok(markdown.includes('管理员核验后补充的现状正文'));
  for (const action of report.actions) {
    for (const text of [action.title, action.metric, action.limitation, action.evidence, ...action.steps]) assert.ok(markdown.includes(text));
  }
  for (const pathway of report.pathways) {
    for (const text of [pathway.name, pathway.firstContact, pathway.deadline, pathway.caveat, ...pathway.evidence, ...pathway.steps]) assert.ok(markdown.includes(text));
    assert.ok(pathway.contactIds.length > 0);
  }
  for (const source of report.sources) assert.ok(markdown.includes(source.url));
  for (const channel of report.helpChannels) for (const value of [channel.title, channel.phone, channel.url, channel.description]) assert.ok(markdown.includes(value));
  assert.ok(markdown.includes('## 证据对应表'));
  const fallback = exportLivelihoodMarkdown(report, []);
  for (const section of report.sections) assert.ok(fallback.includes(formatLivelihoodCitations(section.body, report)));
  assert.ok(!fallback.includes('[LABOR_CONTRACT]'));
  assert.ok(!markdown.includes('LABOR_CONTRACT｜'));
  const source = report.sources[0];
  assert.equal(formatLivelihoodCitations(`备注保留 [${source.id}] [custom-note]`, report), `备注保留 [[1]](${source.url}) [custom-note]`);
  assert.equal(formatLivelihoodCitations(`[${source.id}｜法律原文](${source.url})`, report), `[1｜法律原文](${source.url})`);
});

test('livelihood navigation opens the specified issue while project entry stays an overview', () => {
  const issue = node(10, { ...livelihoodIssue001 });
  const project = node(1, { ...livelihoodProject, type: 'folder', scene: 'system', children: [issue, node(20)] });
  assert.equal(folderNavigationPath([project], project), '/home?project=1');
  assert.equal(folderNavigationPath([project], issue), '/home?project=1&lifeView=issues&lifeIssue=10&lifeSection=situation');
  assert.equal(folderNavigationPath([project], node(20)), '/home?project=1&folder=20');
});

test('only marked issue folders are archived in deterministic order without mutating children', () => {
  const children = [node(2, { description: livelihoodIssueMarker, sortOrder: 1 }), node(3, { description: livelihoodIssueMarker, sortOrder: 2 }),
    node(4, { title: '选题池', description: livelihoodIssueMarker, type: 'text' }), node(5, { title: '普通目录' })];
  assert.deepEqual(livelihoodIssues(node(1, { children })).map((item) => item.id), [3, 2]);
  assert.deepEqual(children.map((item) => item.id), [2, 3, 4, 5]);
});
