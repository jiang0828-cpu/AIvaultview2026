import { randomBytes } from 'node:crypto';
import type { Content, PrismaClient, User } from '@prisma/client';
import { z } from 'zod';
import { fail } from './http.js';
import { canReadContentMedia, canReadMedia, readableContents, requireContent } from './permissions.js';

const tags = ['article', 'section', 'header', 'footer', 'main', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'figure',
  'figcaption', 'blockquote', 'pre', 'code', 'strong', 'em', 'small', 'b', 'i', 'u', 's', 'mark', 'sub', 'sup',
  'br', 'hr', 'a', 'img', 'video', 'audio', 'source', 'details', 'summary', 'time', 'label', 'svg', 'g', 'path',
  'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'linearGradient', 'stop'] as const;
export type PageNode = string | { tag: typeof tags[number]; attrs: Record<string, string>; children: PageNode[] };
const attrNames = new Set(['className', 'href', 'src', 'alt', 'title', 'colSpan', 'rowSpan', 'width', 'height',
  'viewBox', 'd', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'points', 'x', 'y', 'x1', 'y1',
  'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'transform', 'opacity', 'offset', 'stopColor', 'stopOpacity',
  'textAnchor', 'dominantBaseline', 'preserveAspectRatio', 'poster', 'type', 'style']);
const safeUrl = (value: string) => /^\/media\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value) || (() => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
})();
const safeStyle = /^(?:(?:width|height|min-width|max-width|min-height|max-height|color|background-color|font-size|font-weight|text-align|display|grid-template-columns|gap|flex|flex-direction|align-items|justify-content|padding|margin|border-radius|aspect-ratio):[\w\s#%.,()/+-]+;?)*$/i;
export const pageNodeSchema: z.ZodType<PageNode> = z.lazy(() => z.union([z.string().max(100000), z.object({
  tag: z.enum(tags), attrs: z.record(z.string().max(4096)).refine(attrs => Object.entries(attrs).every(([name, value]) =>
    attrNames.has(name) && (!['href', 'src', 'poster'].includes(name) || safeUrl(value)) &&
    (name !== 'style' || safeStyle.test(value)) && (!['fill', 'stroke'].includes(name) || !/url\s*\(/i.test(value))), '页面属性不安全'),
  children: z.array(pageNodeSchema).max(20000),
}).strict()]));
export const pageInputSchema = z.preprocess(value => {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > 100000 || item.depth > 90) fail(400, 'INVALID_PAGE', '页面过大或层级过多');
    if (item.value && typeof item.value === 'object')
      for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 });
  }
  return value;
}, z.object({ title: z.string().trim().min(1).max(240), nodes: z.array(pageNodeSchema).max(20000) }).strict());
export type PageSnapshot = z.infer<typeof pageInputSchema> & { capturedAt: string; media: string[] };

export async function sharedRows(db: PrismaClient, contentId: number, ownerId: number) {
  const owner = await db.user.findUnique({ where: { id: ownerId } });
  if (!owner?.enabled || owner.mustChangePassword) return fail(404, 'SHARE_NOT_FOUND', '分享内容已撤回或无权访问');
  const root = await requireContent(db, owner, contentId);
  const visible = await readableContents(db, owner);
  const ids = new Set([root.id]);
  for (let size = 0; size !== ids.size;) {
    size = ids.size;
    for (const row of visible) if (row.parentId && ids.has(row.parentId) && !('navigationOnly' in row)) ids.add(row.id);
  }
  return visible.filter(row => ids.has(row.id)).map(row => ({ ...row, parentId: row.id === root.id ? null : row.parentId }));
}

export async function savePageSnapshot(db: PrismaClient, user: User, contentId: number | undefined, input: z.infer<typeof pageInputSchema>) {
  if (Buffer.byteLength(JSON.stringify(input)) > 750000) fail(413, 'PAGE_TOO_LARGE', '页面内容过多，请改为分享项目或单份资料');
  const rows = contentId ? await sharedRows(db, contentId, user.id) : null;
  const media = new Set<string>();
  let count = 0;
  function visit(nodes: PageNode[], depth = 0) {
    if (depth > 80) fail(400, 'PAGE_TOO_DEEP', '页面层级过多');
    for (const node of nodes) {
      if (++count > 20000) fail(400, 'PAGE_TOO_LARGE', '页面内容过多');
      if (typeof node === 'string') continue;
      for (const name of ['src', 'href', 'poster']) {
        const value = node.attrs[name];
        if (value?.startsWith('/media/')) media.add(value.split(/[?#]/)[0]);
      }
      visit(node.children, depth + 1);
    }
  }
  visit(input.nodes);
  if (media.size > 300) fail(400, 'TOO_MANY_MEDIA', '页面媒体过多');
  for (const path of media) {
    const allowed = rows ? await rowsAllowMedia(rows, path.slice(6)) : await canReadMedia(db, user, path.slice(6));
    if (!allowed) fail(403, 'MEDIA_SCOPE', '页面包含当前分享范围以外的媒体，请分享相应资料');
  }
  const id = randomBytes(12).toString('base64url');
  const snapshot: PageSnapshot = { ...input, capturedAt: new Date().toISOString(), media: [...media] };
  await db.config.create({ data: { key: `share.page.${id}`, value: JSON.stringify(snapshot) } });
  return id;
}

export async function readPageSnapshot(db: PrismaClient, id: string): Promise<PageSnapshot> {
  const row = await db.config.findUnique({ where: { key: `share.page.${id}` } });
  if (!row) return fail(404, 'SHARE_NOT_FOUND', '分享页面不存在');
  return JSON.parse(row.value) as PageSnapshot;
}

export async function rowsAllowMedia(rows: Content[], path: string) {
  for (const row of rows) if (await canReadContentMedia(row, path)) return true;
  return false;
}
