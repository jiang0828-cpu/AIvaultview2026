import type { WriterProfile } from '../../backend/prisma/writers/schema';
export type { WriterProfile };

export const literaryRegions = [
  { name: '中国', en: 'CHINA', code: 'CN', theme: '诗文传统与现代书写' },
  { name: '古希腊', en: 'ANCIENT GREECE', code: 'GR', theme: '史诗、戏剧与思想' },
  { name: '英国与爱尔兰', en: 'BRITAIN & IRELAND', code: 'GB', theme: '戏剧、诗歌与小说' },
  { name: '法国与法语文学', en: 'FRENCH LITERATURE', code: 'FR', theme: '小说、散文与文学思潮' },
  { name: '德语文学', en: 'GERMAN LITERATURE', code: 'DE', theme: '诗歌、哲思与叙事' },
  { name: '俄语文学', en: 'RUSSIAN LITERATURE', code: 'RU', theme: '长篇小说与人的处境' },
  { name: '日本', en: 'JAPAN', code: 'JP', theme: '古典物语与现代文学' },
  { name: '意大利', en: 'ITALY', code: 'IT', theme: '文艺复兴与现代叙事' },
];
export type WriterFilters = { q?: string; country?: string; era?: string; genre?: string; topic?: string; sort?: string };
export function filterWriters(writers: WriterProfile[], filters: WriterFilters) {
  const terms = (filters.q || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return writers.filter((item) => {
    const text = [item.name, item.originalName, item.context, item.summary, ...item.topics, ...item.works.map((w) => w.title)].join(' ').toLocaleLowerCase();
    return terms.every((term) => text.includes(term)) && (!filters.country || item.country === filters.country)
      && (!filters.era || item.era === filters.era) && (!filters.genre || item.genres.includes(filters.genre as WriterProfile['genres'][number]))
      && (!filters.topic || item.topics.includes(filters.topic));
  }).sort((a, b) => filters.sort === 'birth'
    ? (a.birthYear ?? Infinity) - (b.birthYear ?? Infinity) || a.name.localeCompare(b.name, 'zh-CN')
    : a.name.localeCompare(b.name, 'zh-CN'));
}
