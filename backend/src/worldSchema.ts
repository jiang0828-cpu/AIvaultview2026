import { z } from 'zod';

export const worldProjectMarker = '<!-- WORLD_PROJECT -->';
export const worldIssueMarker = '<!-- WORLD_ISSUE -->';
export const worldDataMarker = '<!-- WORLD_DATA_V1 -->';
const text = z.string().min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const refs = z.array(text).min(1);
const evidence = z.enum(['observed', 'forecast', 'policy', 'study', 'calculated']);
const evidenceRecord = z.object({ id: text, title: text, kind: z.enum(['data', 'fact', 'statement', 'allegation']),
  value: z.number().finite().optional(), unit: text.optional(), period: text, basis: text, origin: text, sourceIds: refs });
const evidenceCalculation = z.object({ id: text, title: text, operation: z.enum(['difference', 'share', 'growth']),
  left: text, right: text, unit: text, decimals: z.number().int().min(0).max(4), note: text });
const evidenceReview = z.object({ revisedOn: date, scope: text, method: text, records: z.array(evidenceRecord).min(1),
  calculations: z.array(evidenceCalculation), claims: z.array(z.object({ id: text, title: text,
    level: z.enum(['supported', 'bounded', 'insufficient', 'conditional']), conclusion: text, reasoning: text,
    counter: text, verify: text, recordIds: refs, calculationIds: z.array(text) })).min(1) });

export function calculateWorldEvidence(calculation: z.infer<typeof evidenceCalculation>, records: z.infer<typeof evidenceRecord>[]) {
  const left = records.find((record) => record.id === calculation.left)?.value;
  const right = records.find((record) => record.id === calculation.right)?.value;
  if (left === undefined || right === undefined) return NaN;
  if (calculation.operation === 'difference') return left - right;
  return (left / right - (calculation.operation === 'growth' ? 1 : 0)) * 100;
}

export const worldReportSchema = z.object({
  version: z.literal(1), number: text, title: text, subtitle: text, asOf: date,
  thesis: text, boundary: text, tags: z.array(text).min(1).max(2),
  timeline: z.array(z.object({ date, title: text, detail: text, sourceIds: refs,
    status: z.enum(['confirmed', 'reported', 'position', 'filed', 'scheduled']) })).min(1).optional(),
  scenarioAudience: z.object({ business: text, household: text }).optional(),
  evidenceReview: evidenceReview.optional(),
  sources: z.array(z.object({ id: text, publisher: text, title: text, published: date, period: text,
    url: z.string().url().refine((url) => url.startsWith('https://')), scope: text })).min(1),
  metrics: z.array(z.object({ label: text, value: z.number().finite(), unit: text, period: text,
    kind: evidence, note: text, sourceIds: refs })).min(1),
  charts: z.array(z.object({ id: text, title: text, subtitle: text, unit: text, max: z.number().positive(),
    note: text, sourceIds: refs, rows: z.array(z.object({ label: text, value: z.number().nonnegative(), kind: evidence })).min(1) })).min(1),
  lenses: z.array(z.object({ id: text, name: text, question: text, summary: text, fact: text,
    mechanism: text, counter: text, watch: text, sourceIds: refs, documentTitle: text })).min(1),
  channels: z.array(z.object({ id: text, title: text, stages: z.array(z.object({ label: text, detail: text })).min(2),
    feedback: text, caveat: text, sourceIds: refs })).min(1),
  scenarios: z.array(z.object({ id: text, name: text, premise: text, conditions: z.array(text).min(2),
    business: text, household: text, invalidation: text })).min(1),
  watchlist: z.array(z.object({ dimension: text, indicator: text, frequency: text, signal: text,
    alternative: text, sourceIds: refs })).min(1),
  agenda: z.array(z.object({ title: text, question: text })).min(1),
}).superRefine((report, ctx) => {
  const ids = new Set(report.sources.map((source) => source.id));
  if (ids.size !== report.sources.length) ctx.addIssue({ code: 'custom', message: 'Duplicate source IDs' });
  for (const collection of [report.charts, report.lenses, report.channels, report.scenarios]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate section IDs' });
  }
  for (const item of [...report.metrics, ...report.charts, ...report.lenses, ...report.channels, ...report.watchlist, ...(report.timeline ?? []), ...(report.evidenceReview?.records ?? [])]) {
    if (item.sourceIds.some((id) => !ids.has(id))) ctx.addIssue({ code: 'custom', message: 'Unknown source ID' });
  }
  for (const chart of report.charts) {
    if (chart.rows.some((row) => row.value > chart.max)) ctx.addIssue({ code: 'custom', message: 'Chart exceeds axis' });
  }
  if (report.sources.some((source) => source.published > report.asOf))
    ctx.addIssue({ code: 'custom', message: 'Source published after issue cutoff' });
  if (report.timeline?.some((item, index, timeline) =>
    (index > 0 && item.date < timeline[index - 1].date) || (item.status !== 'scheduled' && item.date > report.asOf)))
    ctx.addIssue({ code: 'custom', message: 'Timeline must be chronological; only scheduled events may follow cutoff' });
  const review = report.evidenceReview;
  if (!review) return;
  const records = new Map(review.records.map((record) => [record.id, record]));
  const calculations = new Map(review.calculations.map((calculation) => [calculation.id, calculation]));
  const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['evidenceReview'], message });
  if (review.revisedOn < report.asOf) issue('Revision cannot precede cutoff');
  if (records.size !== review.records.length || calculations.size !== review.calculations.length ||
    new Set(review.claims.map(({ id }) => id)).size !== review.claims.length) issue('Duplicate evidence IDs');
  for (const record of review.records) {
    if (record.kind === 'data' ? record.value === undefined || record.unit === undefined : record.value !== undefined || record.unit !== undefined)
      issue(`Invalid numeric fields for ${record.id}`);
  }
  for (const calculation of review.calculations) {
    const left = records.get(calculation.left);
    const right = records.get(calculation.right);
    const unit = calculation.operation === 'difference' ? (left?.unit === '%' ? '个百分点' : left?.unit) : '%';
    if (calculation.left === calculation.right || left?.kind !== 'data' || right?.kind !== 'data' || left.unit !== right.unit ||
      (calculation.operation !== 'growth' && left.period !== right.period) ||
      (calculation.operation !== 'difference' && right.value! <= 0) ||
      calculation.unit !== unit || !Number.isFinite(calculateWorldEvidence(calculation, review.records)))
      issue(`Invalid calculation inputs for ${calculation.id}`);
  }
  for (const claim of review.claims) {
    if (new Set(claim.recordIds).size !== claim.recordIds.length || claim.recordIds.some((id) => !records.has(id)))
      issue(`Invalid record references for ${claim.id}`);
    if (claim.level === 'supported' && !claim.recordIds.some((id) => ['data', 'fact'].includes(records.get(id)?.kind ?? '')))
      issue(`Supported claim lacks direct evidence: ${claim.id}`);
    if (new Set(claim.calculationIds).size !== claim.calculationIds.length || claim.calculationIds.some((id) => {
      const calculation = calculations.get(id);
      return !calculation || !claim.recordIds.includes(calculation.left) || !claim.recordIds.includes(calculation.right);
    })) issue(`Claim omits calculation inputs: ${claim.id}`);
  }
});
export type WorldReport = z.infer<typeof worldReportSchema>;

export function parseWorldReport(description: string) {
  if (!description.startsWith(worldDataMarker)) return null;
  try {
    const result = worldReportSchema.safeParse(JSON.parse(description.slice(worldDataMarker.length).trim()));
    return result.success ? result.data : null;
  } catch { return null; }
}
