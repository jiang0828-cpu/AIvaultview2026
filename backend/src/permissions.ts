import type { Content, Prisma, PrismaClient, User } from '@prisma/client';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { projectRoot } from './config.js';
import { fail } from './http.js';

function projectOwner(row: Content, rows: Map<number, Content>): number | null {
  const seen = new Set<number>();
  let current: Content | undefined = row;
  while (current && !seen.has(current.id)) {
    if (current.isProject) return current.id;
    seen.add(current.id);
    current = current.parentId ? rows.get(current.parentId) : undefined;
  }
  return null;
}

async function visibility(db: PrismaClient, user: User) {
  const rows = await db.content.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  const byId = new Map(rows.map(row => [row.id, row]));
  const grants = new Set((await db.projectAccess.findMany({ where: { userId: user.id } })).map(row => row.projectId));
  const visible = rows.filter(row => user.role === 'admin' || grants.has(projectOwner(row, byId) ?? -1));
  return { rows, byId, visible };
}

export async function readableContents(db: PrismaClient, user: User) {
  const { rows, byId, visible } = await visibility(db, user);
  const allowed = new Set(visible.map(row => row.id));
  const navigation = new Set<number>();
  for (const row of visible) {
    let current = row.parentId ? byId.get(row.parentId) : undefined;
    while (current && !allowed.has(current.id) && !navigation.has(current.id)) {
      navigation.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return rows.filter(row => allowed.has(row.id) || navigation.has(row.id)).map(row => allowed.has(row.id) ? row : {
    ...row, description: '', topics: null, coverUrl: null, fileUrl: null, hlsUrl: null,
    pdfUrl: null, imagesJson: null, assetsJson: null, navigationOnly: true,
  });
}

export async function requireContent(db: PrismaClient, user: User, id: number) {
  const { visible } = await visibility(db, user);
  const row = visible.find(item => item.id === id);
  return row || fail(404, 'NOT_FOUND', '资料不存在或无权访问');
}

export async function validateProjectTree(tx: Prisma.TransactionClient,
  input: { isProject: boolean; parentId: number | null }, id?: number) {
  const rows = await tx.content.findMany();
  const byId = new Map(rows.map(row => [row.id, row]));
  if (input.isProject) {
    const parent = input.parentId ? byId.get(input.parentId) : undefined;
    if (parent && projectOwner(parent, byId) !== null)
      fail(400, 'NESTED_PROJECT', '项目不能放入另一个项目');
    const pending = rows.filter(row => row.parentId === id);
    for (let index = 0; index < pending.length; index++) {
      if (pending[index].isProject) fail(400, 'NESTED_PROJECT', '项目不能包含另一个项目');
      pending.push(...rows.filter(row => row.parentId === pending[index].id));
    }
  } else if (id && rows.some(row => row.id === id && row.isProject)) {
    // Converting a project to a directory must not silently merge it into another project's grant.
    const parent = input.parentId ? byId.get(input.parentId) : undefined;
    if (parent && projectOwner(parent, byId) !== null)
      fail(400, 'NESTED_PROJECT', '请先将项目改为普通目录，再移动内容');
  } else if (input.parentId) {
    // Moving a whole directory can also move project roots hidden below it.
    const parent = byId.get(input.parentId);
    if (parent && projectOwner(parent, byId) !== null && id) {
      const pending = rows.filter(row => row.parentId === id);
      for (let index = 0; index < pending.length; index++) {
        if (pending[index].isProject) fail(400, 'NESTED_PROJECT', '目录中包含项目，不能移入另一个项目');
        pending.push(...rows.filter(row => row.parentId === pending[index].id));
      }
    }
  }
}

const mediaRoot = resolve(projectRoot, 'backend/media');
const parser = unified().use(remarkParse);

export function canonicalPath(url: string): string | null {
  try {
    const raw = url.split(/[?#]/, 1)[0];
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/media/') || /[\\%]/.test(decoded) || [...decoded].some(char => char.charCodeAt(0) < 32)) return null;
    const segments = decoded.slice(7).split('/');
    if (segments.some(part => !part || part.startsWith('.'))) return null;
    return decoded;
  } catch { return null; }
}

function localReference(url: string, base: string): string | null {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return null;
  if (url.startsWith('/media/')) return canonicalPath(url);
  try { return canonicalPath(new URL(url, `http://local${base}`).pathname); }
  catch { return null; }
}

function references(value: unknown, base: string, found: Set<string>) {
  if (Array.isArray(value)) { for (const item of value) references(item, base, found); return; }
  if (value && typeof value === 'object') { for (const item of Object.values(value)) references(item, base, found); return; }
  if (typeof value !== 'string') return;
  const direct = value.startsWith('/media/') ? canonicalPath(value) : null;
  if (direct) found.add(direct);
  const json = value.replace(/^(?:\s*<!--[\s\S]*?-->\s*)+/, '').trim();
  if (json.startsWith('{') || json.startsWith('[')) {
    try { references(JSON.parse(json), base, found); return; } catch { /* Markdown can also start with a link. */ }
  }
  const visit = (node: { url?: string; children?: unknown[] }) => {
    if (node.url) { const path = localReference(node.url, base); if (path) found.add(path); }
    for (const child of node.children || []) visit(child as typeof node);
  };
  visit(parser.parse(value));
}

async function confinedFile(path: string) {
  const filename = resolve(mediaRoot, path.slice(7));
  try {
    const actual = await realpath(filename);
    const root = await realpath(mediaRoot);
    const rel = relative(root, actual);
    if (rel.startsWith('..') || isAbsolute(rel)) return null;
    return actual;
  } catch { return null; }
}

export async function canReadMedia(db: PrismaClient, user: User, requestPath: string) {
  const path = canonicalPath(`/media${requestPath}`);
  if (!path || !await confinedFile(path)) return false;
  if (user.role === 'admin') return true;
  const { visible } = await visibility(db, user);
  const index = new Set<string>();
  for (const content of visible) {
    for (const value of [content.coverUrl, content.fileUrl, content.hlsUrl, content.pdfUrl, content.imagesJson, content.assetsJson, content.description])
      references(value, '/media/', index);
  }
  const projectIds = visible.filter(row => row.isProject).map(row => row.id);
  for (const writer of await db.literaryWriter.findMany({ where: { projectId: { in: projectIds } } }))
    references(writer.data, '/media/', index);
  return mediaReferencesAllow(index, path);
}

export async function canReadContentMedia(content: Content, requestPath: string) {
  const path = canonicalPath(`/media${requestPath}`);
  if (!path || !await confinedFile(path)) return false;
  const index = new Set<string>();
  for (const value of [content.coverUrl, content.fileUrl, content.hlsUrl, content.pdfUrl, content.imagesJson, content.assetsJson, content.description])
    references(value, '/media/', index);
  return mediaReferencesAllow(index, path);
}

async function mediaReferencesAllow(index: Set<string>, path: string) {
  // Expand only explicit dependencies, never directory prefixes. The visited set bounds cyclic manifests.
  const visited = new Set<string>();
  for (const asset of index) {
    if (asset === path) return true;
    if (visited.has(asset)) continue;
    visited.add(asset);
    const extension = extname(asset).toLowerCase();
    if (!['.json', '.md', '.markdown', '.m3u8'].includes(extension)) continue;
    const file = await confinedFile(asset);
    if (!file) continue;
    if ((await stat(file)).size > 10 * 1024 * 1024) continue;
    const text = await readFile(file, 'utf8');
    if (extension === '.m3u8') {
      for (const line of text.split(/\r?\n/)) {
        const uris = line.startsWith('#') ? [...line.matchAll(/URI="([^"]+)"/g)].map(match => match[1]) : [line.trim()];
        for (const uri of uris.filter(Boolean)) { const ref = localReference(uri, asset); if (ref) index.add(ref); }
      }
    } else if (extension === '.json') {
      try { references(JSON.parse(text), asset, index); } catch { /* Invalid JSON grants no dependencies. */ }
    } else references(text, asset, index);
  }
  return false;
}
