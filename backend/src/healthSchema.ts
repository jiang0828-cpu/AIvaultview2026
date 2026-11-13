import { z } from 'zod';

export const healthProjectMarker = '<!-- FAMILY_HEALTH_PROJECT -->';
export const healthProjectTitle = '基础生活｜健｜健康管理';
export const healthWorkspaceByteLimit = 100_000;
const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, '记录标识格式无效');
const text = z.string().max(4000);
const label = z.string().trim().max(80);
const requiredLabel = label.min(1, '请填写名称或责任人');

export const healthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期使用 YYYY-MM-DD 格式')
  .refine(value => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, '请填写真实存在的日期');
const optionalDate = z.union([z.literal(''), healthDate]);
const timestamp = z.string().datetime({ offset: true }).refine(value => {
  const date = value.slice(0, 10);
  return healthDate.safeParse(date).success;
}, '请填写真实存在的测量日期和时间');

const member = z.object({
  id, name: requiredLabel, birthDate: optionalDate, relationship: label,
  management: z.enum(['general', 'risk', 'stable', 'changing']),
  conditions: text, allergies: text, emergencyContact: text, doctor: label,
  hospital: z.string().max(160), doctorContact: text, goals: text, monitoringPlan: text,
  consent: z.boolean().refine(value => value, '请先确认本人同意或监护人授权管理健康资料'),
}).strict().refine(value => !value.birthDate || value.birthDate <= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }), {
  path: ['birthDate'], message: '出生日期不能晚于今天',
});

const measurement = z.object({
  id, memberId: id,
  kind: z.enum(['bloodPressure', 'weight', 'sleep', 'activity', 'glucose', 'temperature']),
  measuredAt: timestamp, value: z.number().finite(), secondary: z.number().finite().nullable(),
  context: text, source: z.enum(['self', 'device', 'clinic']), note: text,
}).strict().superRefine((value, ctx) => {
  const ranges = { bloodPressure: [30, 300], weight: [0.1, 500], sleep: [0, 24],
    activity: [0, 1440], glucose: [0.1, 60], temperature: [25, 45] } as const;
  const [minimum, maximum] = ranges[value.kind];
  if (value.value < minimum || value.value > maximum)
    ctx.addIssue({ code: 'custom', path: ['value'], message: `录入数值须在 ${minimum}–${maximum} 之间；这不是医学正常范围` });
  if (value.kind === 'bloodPressure') {
    if (value.secondary === null || value.secondary < 20 || value.secondary > 200 || value.secondary >= value.value)
      ctx.addIssue({ code: 'custom', path: ['secondary'], message: '请填写 20–200 mmHg 的舒张压，并核对其小于收缩压' });
  } else if (value.secondary !== null) {
    ctx.addIssue({ code: 'custom', path: ['secondary'], message: '仅血压记录使用第二数值' });
  }
});

const action = z.object({
  id, memberId: id, title: z.string().trim().min(1).max(160),
  category: z.enum(['lifestyle', 'medication', 'followup', 'prevention', 'other']),
  dueDate: healthDate, owner: requiredLabel, focus: z.boolean(),
  recurrence: z.enum(['none', 'daily', 'weekly']).optional(),
  status: z.enum(['todo', 'doing', 'waiting', 'done']), evidence: text, obstacle: text,
}).strict().refine(value => value.status !== 'done' || value.evidence.trim().length > 0, {
  path: ['evidence'], message: '完成行动时请记录结果或完成依据',
});

const medication = z.object({
  id, memberId: id, name: z.string().trim().min(1).max(160), strength: text, dose: text,
  schedule: text, purpose: text, prescriber: label, notes: text, reviewDate: optionalDate,
}).strict();
const visit = z.object({
  id, memberId: id, date: healthDate, institution: z.string().trim().min(1).max(160),
  reason: text, questions: text, status: z.enum(['planned', 'waiting', 'done']),
  outcome: text, nextDate: optionalDate,
}).strict().refine(value => value.status !== 'done' || value.outcome.trim().length > 0, {
  path: ['outcome'], message: '就诊完成时请记录结果和下一步安排',
});
const review = z.object({
  id, memberId: id, date: healthDate, changes: text, support: text, nextSteps: text, simplify: text,
}).strict();

export const healthWorkspaceSchema = z.object({
  members: z.array(member).max(12, '最多管理 12 位成员'),
  measurements: z.array(measurement).max(600, '最多保存 600 条测量记录，请先导出归档'),
  actions: z.array(action).max(150), medications: z.array(medication).max(100),
  visits: z.array(visit).max(100), reviews: z.array(review).max(100),
}).strict().superRefine((value, ctx) => {
  const memberIds = new Set(value.members.map(item => item.id));
  for (const [collection, rows] of Object.entries(value)) {
    const seen = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (seen.has(row.id)) ctx.addIssue({ code: 'custom', path: [collection, index, 'id'], message: '记录标识不能重复' });
      seen.add(row.id);
      if ('memberId' in row && !memberIds.has(row.memberId))
        ctx.addIssue({ code: 'custom', path: [collection, index, 'memberId'], message: '记录所属成员不存在，请一并处理关联记录' });
    }
  }
  for (const memberId of memberIds) {
    if (value.actions.filter(item => item.memberId === memberId && item.focus && item.status !== 'done').length > 3)
      ctx.addIssue({ code: 'custom', path: ['actions'], message: '每位成员最多保留三个未完成的阶段重点' });
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > healthWorkspaceByteLimit)
    ctx.addIssue({ code: 'custom', message: '工作区资料超过 100 KB，请先导出归档并减少记录' });
});

export type ValidHealthWorkspace = z.infer<typeof healthWorkspaceSchema>;
export const healthVersionSchema = z.number().int().min(0).max(2_000_000_000);
export const healthSaveSchema = z.object({ version: healthVersionSchema, data: healthWorkspaceSchema }).strict();
export const healthDeleteSchema = z.object({ version: healthVersionSchema }).strict();
export function emptyHealthWorkspace(): ValidHealthWorkspace {
  return { members: [], measurements: [], actions: [], medications: [], visits: [], reviews: [] };
}
