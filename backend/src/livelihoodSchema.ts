import { z } from 'zod';

export const livelihoodProjectMarker = '<!-- LIVELIHOOD_PROJECT -->';
export const livelihoodIssueMarker = '<!-- LIVELIHOOD_ISSUE -->';
export const livelihoodDataMarker = '<!-- LIVELIHOOD_DATA_V1 -->';

const text = z.string().trim().min(1);
const refs = z.array(text).min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
export const livelihoodReportSchema = z.object({
  version: z.literal(1), number: text, title: text, subtitle: text, asOf: date,
  introduction: text, conclusion: text, boundary: text, tags: z.array(text).min(1).max(2),
  takeaways: z.array(text).min(3),
  sources: z.array(z.object({ id: text, title: text, publisher: text, published: date,
    dateKind: z.enum(['published', 'issued', 'accessed']).default('published'),
    url: z.string().url().refine((url) => url.startsWith('https://')), scope: text, locator: text })).min(1),
  helpChannels: z.array(z.object({ id: text, title: text, description: text,
    phone: z.string().regex(/^[0-9+ -]{3,24}$/), url: z.string().url().refine((url) => url.startsWith('https://')),
    sourceIds: refs })).default([]),
  sections: z.array(z.object({ id: z.enum(['situation', 'problems', 'analysis', 'solutions']), title: text,
    question: text, summary: text, body: text, sourceIds: refs, documentTitle: text })).length(4),
  facts: z.array(z.object({ id: text, title: text, detail: text, period: text, basis: text,
    kind: z.enum(['law', 'policy', 'data', 'case']), sourceIds: refs })).min(1),
  relationships: z.array(z.object({ id: text, name: text, situation: text, judgment: text,
    rights: z.array(text).min(2), limits: text, sourceIds: refs })).min(4),
  problems: z.array(z.object({ id: text, title: text, impact: text, mechanism: text,
    counter: text, sourceIds: refs })).min(5),
  mechanisms: z.array(z.object({ id: text, title: text, stages: z.array(text).min(3),
    explanation: text, alternative: text, sourceIds: refs })).min(3),
  actions: z.array(z.object({ id: text, actor: text, title: text, priority: z.enum(['immediate', 'ongoing', 'structural']),
    trigger: text, steps: z.array(text).min(2), evidence: text, metric: text, limitation: text, sourceIds: refs })).min(6),
  pathways: z.array(z.object({ id: text, name: text, when: text, steps: z.array(text).min(2),
    firstContact: z.string().default(''), contactIds: z.array(text).default([]),
    evidence: z.array(text).min(2), deadline: text, caveat: text, sourceIds: refs })).min(4),
  checklist: z.array(text).min(4),
  watchlist: z.array(z.object({ indicator: text, method: text, limitation: text })).min(3),
}).superRefine((report, ctx) => {
  const sourceIds = new Set(report.sources.map((source) => source.id));
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (sourceIds.size !== report.sources.length) error('Duplicate source IDs');
  if (report.sources.some((source) => source.published > report.asOf)) error('Source after issue cutoff');
  const collections = [report.sections, report.facts, report.relationships, report.problems, report.mechanisms, report.actions, report.pathways, report.helpChannels];
  for (const items of collections) {
    if (new Set(items.map((item) => item.id)).size !== items.length) error('Duplicate section IDs');
    for (const item of items) if (item.sourceIds.some((id) => !sourceIds.has(id))) error('Unknown source ID');
  }
  if (new Set(report.sections.map((item) => item.documentTitle)).size !== 4) error('Duplicate document titles');
  for (const section of report.sections) {
    for (const match of section.body.matchAll(/\[([A-Z][A-Z0-9_]*)\]/g)) if (!sourceIds.has(match[1])) error('Unknown source marker in section body');
  }
  const contactIds = new Set(report.helpChannels.map((item) => item.id));
  if (report.pathways.some((item) => item.contactIds.some((id) => !contactIds.has(id)))) error('Unknown help channel');
});

export type LivelihoodReport = z.infer<typeof livelihoodReportSchema>;
export function formatLivelihoodCitations(text: string, report: LivelihoodReport) {
  return report.sources.reduce((value, source, index) => value
    .replaceAll(`[${source.id}]`, `[[${index + 1}]](${source.url})`)
    .replaceAll(`[${source.id}｜`, `[${index + 1}｜`), text);
}
export function parseLivelihoodReport(description: string): LivelihoodReport | null {
  if (!description.startsWith(livelihoodDataMarker)) return null;
  try {
    const result = livelihoodReportSchema.safeParse(JSON.parse(description.slice(livelihoodDataMarker.length).trim()));
    return result.success ? result.data : null;
  } catch { return null; }
}
