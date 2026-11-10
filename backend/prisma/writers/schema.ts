import { z } from 'zod';

export const writerSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/),
  name: z.string().min(1), originalName: z.string().min(1),
  country: z.enum(['CN', 'GR', 'GB', 'FR', 'DE', 'RU', 'JP', 'IT']),
  context: z.string().min(8), era: z.string().min(1),
  birthYear: z.number().int().nullable(), deathYear: z.number().int().nullable(),
  dates: z.string().min(1),
  genres: z.array(z.enum(['诗歌与抒情', '小说与叙事', '戏剧与舞台', '散文与思想'])).min(1),
  topics: z.array(z.string()).min(1).max(2),
  summary: z.string().min(20), biography: z.string().min(100),
  significance: z.string().min(60), reading: z.string().min(50), cautions: z.string().min(15),
  works: z.array(z.object({ title: z.string().min(1), date: z.string().min(1), note: z.string().min(15) })).min(1),
  timeline: z.array(z.object({ date: z.string().min(1), event: z.string().min(10) })).min(3),
  sources: z.array(z.object({ label: z.string().min(1), url: z.string().url(), scope: z.string().min(8) })).min(1),
  checkedAt: z.literal('2026-11-10'),
  reviewStatus: z.literal('资料核对版·待人工复核'),
}).strict().superRefine((writer, ctx) => {
  if (writer.birthYear !== null && writer.deathYear !== null && writer.birthYear > writer.deathYear)
    ctx.addIssue({ code: 'custom', message: 'Birth must precede death' });
});
export type WriterProfile = z.infer<typeof writerSchema>;
export type WriterDraft = Omit<WriterProfile, 'checkedAt' | 'reviewStatus'>;
export const writer = (draft: WriterDraft): WriterProfile => writerSchema.parse({
  ...draft, checkedAt: '2026-11-10', reviewStatus: '资料核对版·待人工复核',
});
export const work = (title: string, date: string, note: string) => ({ title, date, note });
export const event = (date: string, event: string) => ({ date, event });
export const source = (label: string, url: string, scope: string) => ({ label, url, scope });
