import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isResearchProject, researchCompletion, researchDefinitions, researchPrompt, researchVersionDiff, searchResearchSources } from '../src/researchModel';
import type { Content } from '../src/types';
import type { ResearchTaskView, ResearchVersionView } from '../src/researchModel';

test('research completion requires exactly one submitted or reviewed task in all four dimensions', () => {
  const tasks = researchDefinitions.map(item => ({ kind: item.kind, status: 'submitted' as const }));
  assert.equal(researchCompletion(tasks).complete, true);
  assert.equal(researchCompletion(tasks.slice(1)).percent, 75);
  assert.equal(researchCompletion([...tasks, tasks[0]]).complete, false);
  assert.equal(researchCompletion(tasks.map(task => ({ ...task, status: 'running' }))).count, 0);
});
test('prompts include the research identity, evidence and responsibility limits', () => {
  for (const definition of researchDefinitions) {
    const prompt = researchPrompt(definition.kind, '测试产品', '判断用户需求');
    assert.ok(prompt.includes('测试产品') && prompt.includes('判断用户需求'));
    assert.ok(prompt.includes(definition.scope) && prompt.includes('来源台账') && prompt.includes('不编造'));
  }
});
test('project detection is restricted to marked work project folders', () => {
  const project = { isProject: true, type: 'folder', scene: 'work', description: '<!-- MARKET_RESEARCH_PROJECT -->' } as Content;
  assert.equal(isResearchProject(project), true);
  assert.equal(isResearchProject({ ...project, scene: 'life' }), false);
  assert.equal(isResearchProject({ ...project, isProject: false }), false);
});
test('source search and history changes preserve their task context', () => {
  const task = { id: 1, title: '宏观环境', sources: [{ id: 'S1', title: '政策原文', publisher: '政府', supports: '准入条件', url: 'https://example.com', published: '未知' }], report: '旧报告' } as ResearchTaskView;
  assert.equal(searchResearchSources([task], '准入')[0].task.id, 1);
  assert.equal(searchResearchSources([task], '没有').length, 0);
  const before = { snapshot: task } as ResearchVersionView;
  const after = { snapshot: { ...task, report: '新报告' } } as ResearchVersionView;
  assert.deepEqual(researchVersionDiff(before, after), [{ field: '研究报告', before: '旧报告', after: '新报告' }]);
});
