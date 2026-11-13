import { z } from 'zod';

export const precisionBriefProjectMarker = '<!-- PRECISION_BRIEF_PROJECT -->';
export const precisionBriefProjectTitle = '行业简报｜精准医疗 | 消息·点评';
export const precisionBriefSections = ['company', 'competitors', 'regulation', 'science', 'partners'] as const;
export const precisionBriefSectionLabels = { company: '世和动态', competitors: '同行与竞对', regulation: '监管与支付', science: '科学与突破', partners: '上下游伙伴' };
export type PrecisionBriefSection = typeof precisionBriefSections[number];
export const precisionBriefDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '日期无效');
const instant = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)), '时间无效');
export const precisionBriefScheduleSchema = z.object({
  automationId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/), enabled: z.boolean(), configuredAt: instant,
  timezone: z.literal('Asia/Shanghai'), hour: z.literal(9),
}).strict();
export type PrecisionBriefSchedule = z.infer<typeof precisionBriefScheduleSchema>;
const contentText = (max: number) => z.string().trim().min(1).max(max);
export const precisionBriefSourceInput = z.object({
  key: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/), title: contentText(300), publisher: contentText(160),
  publishedAt: z.union([instant, precisionBriefDate]), accessedAt: instant,
  url: z.string().max(2048).url().refine(value => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }, '来源须为HTTP(S)地址'),
  sourceType: z.enum(['official', 'paper', 'media']), verified: z.boolean(),
}).strict();
export const precisionBriefTaskInput = z.object({
  kind: z.enum(precisionBriefSections), status: z.enum(['completed', 'no_news', 'failed']),
  rawReport: z.string().max(30000).default(''), coverage: contentText(5000), errorMessage: z.string().max(2000).default(''),
}).strict();
export const precisionBriefItemInput = z.object({
  section: z.enum(precisionBriefSections), title: contentText(160), message: contentText(1000), attention: contentText(1000),
  commentary: contentText(1000), severity: z.enum(['normal', 'important']).default('normal'),
  sourceIds: z.array(z.string()).min(1).max(10), sortOrder: z.number().int().min(0).max(100).default(0),
}).strict();
export const precisionBriefInputSchema = z.object({
  runKey: z.string().trim().regex(/^[A-Za-z0-9_.:-]{1,120}$/), runId: z.number().int().positive().optional(),
  issueDate: precisionBriefDate, windowStart: instant, windowEnd: instant, firstIssue: z.boolean().default(false),
  summary: contentText(3000), tasks: z.array(precisionBriefTaskInput).length(5),
  items: z.array(precisionBriefItemInput).max(15), sources: z.array(precisionBriefSourceInput).max(60),
}).strict().superRefine((input, ctx) => {
  const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  const start = Date.parse(input.windowStart), end = Date.parse(input.windowEnd);
  if (start >= end) error(['windowEnd'], '资料截止时间须晚于开始时间');
  if (end > Date.now() + 60000) error(['windowEnd'], '资料截止时间不能晚于当前时间');
  const hours = (end - start) / 3600000;
  if (hours > (input.firstIssue ? 168 : 24) + 0.001) error(['windowStart'], input.firstIssue ? '首期回看不得超过7天' : '日报窗口不得超过24小时');
  if (Number.isFinite(end)) {
    const issueDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(end));
    if (issueDay !== input.issueDate) error(['issueDate'], '期次日期须与北京时间资料截止日一致');
  }
  if (new Set(input.tasks.map(task => task.kind)).size !== 5) error(['tasks'], '五个专题任务须各有且仅有一项');
  const keys = new Set(input.sources.map(source => source.key));
  if (keys.size !== input.sources.length) error(['sources'], '来源编号不可重复');
  const urls = new Set<string>();
  for (const [index, source] of input.sources.entries()) {
    let url: URL;
    try { url = new URL(source.url); } catch { error(['sources', index, 'url'], '来源URL无效'); continue; }
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    const canonical = url.href.replace(/\/$/, '');
    if (urls.has(canonical)) error(['sources', index, 'url'], '同一来源地址不可重复');
    urls.add(canonical);
    if (/^(?:www\.)?example\.(?:com|org|net)$/.test(url.hostname) || /(?:^|\.)(?:test|invalid|example)$/.test(url.hostname) || /^(localhost|127\.|0\.|\[::1\])/.test(url.hostname)) error(['sources', index, 'url'], '占位或本地URL不可发布');
    const publishedStart = source.publishedAt.length === 10 ? Date.parse(`${source.publishedAt}T00:00:00+08:00`) : Date.parse(source.publishedAt);
    const publishedEnd = publishedStart + (source.publishedAt.length === 10 ? 86400000 - 1 : 0);
    if (publishedStart > end) error(['sources', index, 'publishedAt'], '来源发布晚于截止时间');
    if (publishedEnd < start) error(['sources', index, 'publishedAt'], '来源不在本期资料窗口内');
    if (Date.parse(source.accessedAt) > Date.now() + 60000) error(['sources', index, 'accessedAt'], '访问时间不能晚于当前时间');
  }
  const titles = new Set<string>();
  const primarySources = new Set<string>();
  for (const [index, item] of input.items.entries()) {
    const normalized = item.title.toLocaleLowerCase().replace(/[\p{P}\p{Z}\p{S}]/gu, '');
    if (titles.has(normalized)) error(['items', index, 'title'], '重复消息标题须合并');
    titles.add(normalized);
    if (Array.from(item.title + item.message + item.attention + item.commentary).length > 300) error(['items', index], '消息、关注点和点评合计不得超过300字');
    if (new Set(item.sourceIds).size !== item.sourceIds.length || item.sourceIds.some(key => !keys.has(key))) error(['items', index, 'sourceIds'], '消息引用了未知或重复来源');
    if (item.sourceIds.some(key => input.sources.find(source => source.key === key)?.verified !== true)) error(['items', index, 'sourceIds'], '消息来源须核验后发布');
    if (primarySources.has(item.sourceIds[0])) error(['items', index, 'sourceIds'], '同一主来源的事件须合并为一条，不得跨栏目复制');
    primarySources.add(item.sourceIds[0]);
  }
  const placeholder = /(?:TODO|TBD|待填写|待补充|占位内容|placeholder)/i;
  for (const [index, item] of input.items.entries()) if ([item.title, item.message, item.attention, item.commentary].some(text => placeholder.test(text))) error(['items', index], '占位内容不可发布');
  if (placeholder.test(input.summary)) error(['summary'], '占位摘要不可发布');
  for (const [index, task] of input.tasks.entries()) {
    const count = input.items.filter(item => item.section === task.kind).length;
    if (count > 3) error(['tasks', index], '每栏最多3条消息');
    if (task.status === 'no_news' && count !== 0) error(['tasks', index], '无新增任务不能包含消息');
    if (task.status === 'completed' && count === 0) error(['tasks', index], '已完成任务须有消息；无消息请明确标记无新增');
    if (task.status !== 'failed' && (task.coverage.length < 20 || placeholder.test(task.coverage) || !task.rawReport.trim() || placeholder.test(task.rawReport))) error(['tasks', index], '须保留真实采集覆盖说明和原始调研结果，不能用占位文本完成任务');
  }
});
export type PrecisionBriefInput = z.infer<typeof precisionBriefInputSchema>;

export function precisionBriefEditionPayload(raw: Record<string, unknown>): PrecisionBriefInput {
  const pick = (row: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
  const rows = (key: string, keys: string[]) => (raw[key] as Record<string, unknown>[]).map(row => pick(row, keys));
  const value = precisionBriefInputSchema.parse({
    ...pick(raw, ['runKey', 'issueDate', 'windowStart', 'windowEnd', 'firstIssue', 'summary']),
    tasks: rows('tasks', Object.keys(precisionBriefTaskInput.shape)),
    items: rows('items', Object.keys(precisionBriefItemInput.shape)),
    sources: rows('sources', Object.keys(precisionBriefSourceInput.shape)),
  });
  value.windowStart = new Date(value.windowStart).toISOString();
  value.windowEnd = new Date(value.windowEnd).toISOString();
  value.tasks.sort((a, b) => a.kind.localeCompare(b.kind));
  value.items.sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title));
  value.sources = value.sources.map(source => ({ ...source, accessedAt: new Date(source.accessedAt).toISOString() }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return value;
}
export type PrecisionBriefSourceView = z.infer<typeof precisionBriefSourceInput> & { id: number };
export type PrecisionBriefItemView = z.infer<typeof precisionBriefItemInput> & { id: number };
export type PrecisionBriefTaskView = Omit<z.infer<typeof precisionBriefTaskInput>, 'status'> & {
  id: number; status: 'queued' | 'running' | 'completed' | 'no_news' | 'failed'; startedAt: string | null; completedAt: string | null;
};
export type PrecisionBriefRunSummary = {
  id: number; projectId: number; runKey: string; issueDate: string; windowStart: string; windowEnd: string; firstIssue: boolean;
  status: 'queued' | 'running' | 'published' | 'failed'; summary: string; publishedAt: string | null; errorMessage: string;
  isCurrent: boolean; createdAt: string; updatedAt: string;
};
export type PrecisionBriefRunView = PrecisionBriefRunSummary & { tasks: PrecisionBriefTaskView[]; items: PrecisionBriefItemView[]; sources: PrecisionBriefSourceView[]; validation: unknown };
export type PrecisionBriefCurrentResponse = { run: PrecisionBriefRunView | null; lastAttempt: PrecisionBriefRunSummary | null; canManage: boolean; canInspect: boolean; schedule?: PrecisionBriefSchedule | null };

export function validatePrecisionBriefForPublish(input: unknown): { success: boolean; data?: PrecisionBriefInput; errors: string[] } {
  const parsed = precisionBriefInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, errors: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`) };
  const errors = parsed.data.tasks.filter(task => task.status === 'failed').map(task => `${precisionBriefSectionLabels[task.kind]}调研失败：${task.errorMessage || '未完成采集'}`);
  return { success: errors.length === 0, data: parsed.data, errors };
}
