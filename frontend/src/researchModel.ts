import type { Content } from './types';
import { researchDefinitions, researchProjectMarker } from '../../backend/src/researchSchema';
import type { ResearchTaskInput, ResearchTaskView, ResearchVersionView } from '../../backend/src/researchSchema';
export { researchDefinitions, researchPrompt, researchStatusLabels, conclusionLabels } from '../../backend/src/researchSchema';
export type { ResearchStudyView, ResearchTaskView, ResearchTaskInput, ResearchSource, ResearchConclusion, ResearchSynthesisView, ResearchVersionView } from '../../backend/src/researchSchema';

export function isResearchProject(project: Content | null | undefined) {
  return Boolean(project?.isProject && project.type === 'folder' && project.scene === 'work' && project.description.includes(researchProjectMarker));
}
export function researchCompletion(tasks: Pick<ResearchTaskView, 'kind' | 'status'>[]) {
  const completed = researchDefinitions.filter(definition => tasks.filter(task => task.kind === definition.kind).length === 1 && tasks.some(task => task.kind === definition.kind && ['submitted', 'reviewed'].includes(task.status)));
  return { count: completed.length, percent: completed.length * 25, complete: tasks.length === 4 && completed.length === 4, missing: researchDefinitions.filter(definition => !completed.includes(definition)) };
}
export function taskInput(task: ResearchTaskView): ResearchTaskInput {
  const { revision, title, prompt, inputMaterials, status, report, sources, conclusions, limitations, openQuestions, asOf, assignedTo, notes } = task;
  return { revision, title, prompt, inputMaterials, status, report, sources: sources.map(source => ({ ...source })), conclusions: conclusions.map(conclusion => ({ ...conclusion, sourceIds: [...conclusion.sourceIds] })), limitations, openQuestions, asOf, assignedTo, notes };
}
export function searchResearchSources(tasks: ResearchTaskView[], query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  return tasks.flatMap(task => task.sources.map(source => ({ source, task }))).filter(({ source, task }) => `${task.title} ${source.id} ${source.title} ${source.publisher} ${source.published} ${source.supports} ${source.url}`.toLocaleLowerCase().includes(keyword));
}
export function researchVersionDiff(before: ResearchVersionView, after: ResearchVersionView) {
  const labels: Record<keyof ResearchTaskInput, string> = { revision: '修订号', title: '任务名称', prompt: '提示词', inputMaterials: '输入资料', status: '状态', report: '研究报告', sources: '来源台账', conclusions: '核心结论', limitations: '研究局限', openQuestions: '待验证问题', asOf: '数据截止日期', assignedTo: '负责人', notes: '备注' };
  return (Object.keys(labels) as (keyof ResearchTaskInput)[]).filter(key => key !== 'revision' && JSON.stringify(before.snapshot[key]) !== JSON.stringify(after.snapshot[key])).map(key => ({ field: labels[key], before: typeof before.snapshot[key] === 'string' ? String(before.snapshot[key]) : JSON.stringify(before.snapshot[key], null, 2), after: typeof after.snapshot[key] === 'string' ? String(after.snapshot[key]) : JSON.stringify(after.snapshot[key], null, 2) }));
}
