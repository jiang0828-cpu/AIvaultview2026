import { z } from 'zod';

export const researchProjectMarker = '<!-- MARKET_RESEARCH_PROJECT -->';
export const researchKinds = ['macro', 'product_tech', 'competitors', 'clinical_need'] as const;
export const researchStatuses = ['draft', 'ready', 'running', 'submitted', 'reviewed'] as const;
export const researchStatusLabels: Record<typeof researchStatuses[number], string> = { draft: '草稿', ready: '待分派', running: '进行中', submitted: '已提交', reviewed: '已审核' };
export const conclusionLabels = { verified_fact: '已核实事实', multiple_sources: '多来源一致判断', single_source: '单一来源判断', inference: '分析推演', hypothesis: '尚未验证的假设' };
export const researchDefinitions = [
  { kind: 'macro', title: '宏观环境代理', scope: '政治、经济、政策、人口、支付能力、行业周期', question: '市场为什么现在值得研究？外部环境是顺风还是逆风？', preferred: '统计局、央行、政府政策原文、国际组织原始报告' },
  { kind: 'product_tech', title: '产品技术代理', scope: '产品形态、技术路线、成熟度、研发门槛、供应链', question: '产品能否实现？技术瓶颈和替代路线是什么？', preferred: '论文原文、注册审评、专利、技术文档、监管记录' },
  { kind: 'competitors', title: '竞品信息代理', scope: '直接与间接竞品、价格、渠道、融资和商业模式', question: '谁已经在解决问题？竞争优势和空白在哪里？', preferred: '企业公告、注册文件、财报、官网产品资料、采购成交信息' },
  { kind: 'clinical_need', title: '临床需求代理', scope: '临床流程、用户痛点、未满足需求、使用障碍、支付与采购；非医疗行业改为真实用户需求', question: '谁真正需要？痛点是否足够强？谁决定采购和使用？', preferred: '指南原文、注册临床试验、流行病学、公开访谈；非医疗用一手用户研究' },
] as const;

export function researchPrompt(kind: typeof researchKinds[number], object: string, goal: string) {
  const definition = researchDefinitions.find(item => item.kind === kind)!;
  return `你是市场调研项目中的【${definition.title}】子代理。\n\n研究对象：${object || '待填写'}\n研究目标：${goal || '待填写'}\n你的负责范围：${definition.scope}\n明确不负责的范围：其他三个子代理的专题；不代替总控做投资、诊疗或进入市场的决定。\n必须回答的问题：${definition.question}\n优先来源：${definition.preferred}\n数据截止日期：请在执行前确定并填写 YYYY-MM-DD。\n输入资料：使用本任务提供的资料，区分原始证据和待核线索。\n\n输出格式：\n1. 核心结论（3—8条，每条区分已核实事实、多来源一致判断、单一来源判断、分析推演或尚未验证假设，关联来源编号）\n2. 关键事实与数据（单位、地区、统计期、发布日期、适用范围）\n3. 来源台账（编号、标题、发布机构、发布日期、原文URL、支持内容；未标发布日期填未知，不臆造）\n4. 对市场判断的影响\n5. 不确定性与局限\n6. 仍需验证的问题\n\n要求：\n- 区分事实、推断和假设；\n- 不编造数据、案例、市场规模或临床结果；\n- 每项重要结论提供来源；\n- 多个转载链接不能当作多个独立来源；\n- 标明资料日期与验证限制；\n- 没有实际访谈不得声称完成临床或用户访谈；\n- 不代替其他子代理完成其职责。`;
}

export const researchDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '日期无效');
export const researchSourceSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,32}$/), title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(160), published: z.union([researchDate, z.literal('未知')]),
  url: z.string().max(2048).url().refine(value => { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }, '来源须为HTTP(S)原文地址'),
  supports: z.string().trim().min(1).max(2000), verified: z.boolean().default(false),
}).strict();
export const researchConclusionSchema = z.object({
  text: z.string().trim().min(1).max(3000), type: z.enum(['verified_fact', 'multiple_sources', 'single_source', 'inference', 'hypothesis']),
  sourceIds: z.array(z.string()).max(30),
}).strict();
export const researchStudyInput = z.object({ title: z.string().trim().min(1).max(160), researchObject: z.string().trim().max(1000), goal: z.string().trim().max(3000) }).strict();
export const researchTaskInput = z.object({
  revision: z.number().int().positive(), title: z.string().trim().min(1).max(160), prompt: z.string().trim().min(1).max(15000),
  inputMaterials: z.string().max(15000), status: z.enum(researchStatuses), report: z.string().max(50000),
  sources: z.array(researchSourceSchema).max(80), conclusions: z.array(researchConclusionSchema).max(8),
  limitations: z.string().max(5000), openQuestions: z.string().max(5000),
  asOf: z.union([researchDate, z.literal('')]), assignedTo: z.string().trim().max(160), notes: z.string().max(5000),
}).strict().superRefine((task, ctx) => {
  const ids = new Set(task.sources.map(source => source.id));
  if (ids.size !== task.sources.length) ctx.addIssue({ code: 'custom', path: ['sources'], message: '来源编号不可重复' });
  for (const [index, conclusion] of task.conclusions.entries()) {
    if (new Set(conclusion.sourceIds).size !== conclusion.sourceIds.length || conclusion.sourceIds.some(id => !ids.has(id))) ctx.addIssue({ code: 'custom', path: ['conclusions', index], message: '结论含未知或重复来源编号' });
    if (conclusion.type !== 'hypothesis' && !conclusion.sourceIds.length) ctx.addIssue({ code: 'custom', path: ['conclusions', index], message: '结论须关联来源' });
    if (conclusion.type === 'multiple_sources' && conclusion.sourceIds.length < 2) ctx.addIssue({ code: 'custom', path: ['conclusions', index], message: '多来源判断至少需要两项独立来源，请人工核查独立性' });
    if (conclusion.type === 'multiple_sources' && new Set(task.sources.filter(source => conclusion.sourceIds.includes(source.id)).map(source => {
      try { const url = new URL(source.url); url.hash = ''; return url.href; } catch { return source.url; }
    })).size < 2) ctx.addIssue({ code: 'custom', path: ['conclusions', index], message: '同一原文地址不能作为两项独立来源' });
    if (conclusion.type === 'verified_fact' && task.sources.filter(source => conclusion.sourceIds.includes(source.id)).some(source => !source.verified)) ctx.addIssue({ code: 'custom', path: ['conclusions', index], message: '已核实事实须使用人工核实过的来源' });
  }
  if (['submitted', 'reviewed'].includes(task.status) && (!task.report.trim() || !task.sources.length || task.conclusions.length < 3 || !task.limitations.trim() || !task.asOf || !task.openQuestions.trim())) ctx.addIssue({ code: 'custom', message: '提交须有报告、来源、3—8条结论、数据截止日期、研究局限和待验证问题' });
});
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ResearchConclusion = z.infer<typeof researchConclusionSchema>;
export type ResearchTaskInput = z.infer<typeof researchTaskInput>;
export type ResearchTaskView = Omit<ResearchTaskInput, 'revision'> & { id: number; studyId: number; kind: typeof researchKinds[number]; revision: number; createdAt: string; updatedAt: string; startedAt: string | null; completedAt: string | null };
export type ResearchSynthesisView = { id: number; studyId: number; status: string; executiveSummary: string; marketOpportunity: string; targetUsers: string; feasibility: string; competition: string; risks: string; recommendation: string; openQuestions: string[]; sourceTaskIds: number[]; createdAt: string; updatedAt: string };
export type ResearchStudyView = z.infer<typeof researchStudyInput> & { id: number; projectId: number; status: string; createdAt: string; updatedAt: string; tasks: ResearchTaskView[]; synthesis: ResearchSynthesisView | null; canEdit: boolean };
export type ResearchVersionView = { id: number; version: number; snapshot: ResearchTaskView; createdAt: string };
