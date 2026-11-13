import assert from 'node:assert/strict';
import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run on the installed server. Credentials exist only in process memory.
const root = process.env.VAULTVIEW_ROOT || '/opt/vaultview/current';
const load = file => import(pathToFileURL(resolve(root, 'node_modules', file)).href);
const prisma = await load('@prisma/client/default.js');
const { PrismaClient } = prisma.default || prisma;
const { default: bcrypt } = await load('bcryptjs/index.js');
const { default: dotenv } = await load('dotenv/lib/main.js');
const env = dotenv.parse(await readFile('/etc/vaultview/vaultview.env'));
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const hostname = 'vault.trialmatch.xin';
const prefix = `deploy-qa-${randomBytes(6).toString('hex')}`;
const usernames = ['admin', 'reader-a', 'reader-b', 'share'].map(role => `${prefix}-${role}`);
let checks = 0;

function request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
  return new Promise((resolveResponse, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request({
      hostname, path, method,
      lookup: (_host, options, callback) => options.all
        ? callback(null, [{ address: '127.0.0.1', family: 4 }])
        : callback(null, '127.0.0.1', 4),
      headers: { Origin: `https://${hostname}`, ...headers,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        let json;
        try { json = JSON.parse(bytes.toString()); } catch { /* Media and HTML are not JSON. */ }
        resolveResponse({ status: res.statusCode, headers: res.headers, json, bytes });
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('HTTPS request timed out')));
    req.on('error', reject);
    req.end(data);
  });
}
function status(result, expected, label) {
  assert.equal(result.status, expected, `${label}: unexpected HTTP status`);
  checks++;
  return result;
}
async function login(username, password) {
  const result = status(await request('/api/auth/login', { method: 'POST', body: { username, password } }), 200, 'Login');
  const value = result.headers['set-cookie']?.find(value => value.startsWith('yaocang_session='));
  assert.ok(value && /; Secure/i.test(value) && /; HttpOnly/i.test(value) && /; SameSite=Strict/i.test(value), 'Secure session attributes');
  checks++;
  return value.split(';', 1)[0];
}
const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
const password = () => randomBytes(24).toString('base64url');

try {
  const initialUsers = await db.user.count();
  const rows = await db.content.findMany();
  const projects = rows.filter(row => row.isProject);
  assert.ok(projects.length >= 2, 'Two projects are required for isolation verification');
  const projectA = projects.find(row => /AI/.test(row.title)) || projects[0];
  const projectB = projects.find(row => row.id !== projectA.id);
  const adminPassword = password();
  await db.user.create({ data: { username: usernames[0], role: 'admin', mustChangePassword: false,
    passwordHash: await bcrypt.hash(adminPassword, 12) } });

  status(await request('/api/health'), 200, 'HTTPS health');
  status(await request('/'), 200, 'Frontend');
  status(await request('/api/contents'), 401, 'Unauthenticated content');
  const adminCookie = await login(usernames[0], adminPassword);
  const adminTree = status(await request('/api/contents', { cookie: adminCookie }), 200, 'Administrator content tree');
  assert.equal(flatten(adminTree.json).length, rows.length, 'All migrated content is visible to administrators');
  checks++;
  const health = projects.find(row => row.description.includes('<!-- FAMILY_HEALTH_PROJECT -->'));
  if (health) status(await request(`/api/health/workspace?projectId=${health.id}`, { cookie: adminCookie }), 200, 'Health workspace');
  const compare = projects.find(row => row.description.includes('<!-- PRICE_COMPARE_PROJECT -->'));
  if (compare) {
    const providers = status(await request(`/api/compare/providers?projectId=${compare.id}`, { cookie: adminCookie }), 200, 'Comparison Python service');
    assert.ok(providers.json.providers.some(provider => provider.platform === 'demo' && provider.status === 'available'));
    checks++;
  }
  const studies = await db.researchStudy.findMany();
  for (const id of new Set(studies.map(row => row.projectId)))
    status(await request(`/api/research/studies/${id}`, { cookie: adminCookie }), 200, 'Migrated research');
  const briefs = projects.filter(row => row.description.includes('PRECISION_BRIEF_PROJECT'));
  for (const project of briefs)
    status(await request(`/api/precision-brief/projects/${project.id}/current`, { cookie: adminCookie }), 200, 'Current precision brief');

  async function reader(username, project) {
    const temporaryPassword = password();
    const created = status(await request('/api/admin/users', { method: 'POST', cookie: adminCookie,
      body: { username, password: temporaryPassword, role: 'visitor' } }), 201, 'Create temporary reader');
    const firstCookie = await login(username, temporaryPassword);
    status(await request('/api/contents', { cookie: firstCookie }), 403, 'First password change is required');
    const newPassword = password();
    status(await request('/api/auth/change-password', { method: 'POST', cookie: firstCookie,
      body: { oldPassword: temporaryPassword, newPassword } }), 200, 'First password change');
    status(await request('/api/auth/me', { cookie: firstCookie }), 401, 'Old session is revoked');
    const cookie = await login(username, newPassword);
    const empty = status(await request('/api/contents', { cookie }), 200, 'Reader without grants');
    assert.deepEqual(empty.json, [], 'No projects are visible without grants');
    checks++;
    status(await request(`/api/admin/users/${created.json.id}/projects`, { method: 'PUT', cookie: adminCookie,
      body: { projectIds: [project.id] } }), 200, 'Grant project');
    return { cookie, userId: created.json.id, user: await db.user.findUniqueOrThrow({ where: { id: created.json.id } }) };
  }
  const a = await reader(usernames[1], projectA);
  const b = await reader(usernames[2], projectB);
  const sharePassword = password();
  const shareUser = await db.user.create({ data: { username: usernames[3], role: 'share', passwordHash: await bcrypt.hash(sharePassword, 12), mustChangePassword: false,
    grants: { create: { projectId: projectA.id } } } });
  const shareCookie = await login(shareUser.username, sharePassword);
  status(await request(`/api/contents/${projectA.id}`, { cookie: shareCookie }), 200, 'Share allowed project');
  status(await request(`/api/contents/${projectB.id}`, { cookie: shareCookie }), 404, 'Share hidden project');
  status(await request('/api/admin/users', { cookie: shareCookie }), 403, 'Share cannot manage users');
  status(await request('/api/trip-plans', { method: 'POST', cookie: shareCookie, body: {} }), 403, 'Share cannot write trips');
  status(await request('/api/health/workspace?projectId=' + projectA.id, { method: 'PUT', cookie: shareCookie, body: {} }), 403, 'Share cannot write health data');
  status(await request('/api/auth/change-password', { method: 'POST', cookie: shareCookie, body: { oldPassword: sharePassword, newPassword: password() } }), 403, 'Share cannot change shared password');
  for (const [account, own, other] of [[a, projectA, projectB], [b, projectB, projectA]]) {
    const tree = status(await request('/api/contents', { cookie: account.cookie }), 200, 'Granted content tree');
    assert.deepEqual(flatten(tree.json).filter(row => row.isProject).map(row => row.id), [own.id], 'Only the granted project is listed');
    checks++;
    status(await request(`/api/contents/${own.id}`, { cookie: account.cookie }), 200, 'Granted project detail');
    status(await request(`/api/contents/${other.id}`, { cookie: account.cookie }), 404, 'Cross-project detail');
    status(await request('/api/admin/users', { cookie: account.cookie }), 403, 'Reader cannot manage users');
    status(await request('/api/log', { method: 'POST', cookie: account.cookie,
      body: { contentId: other.id, action: 'view_text' } }), 404, 'Cross-project log');
  }

  const { canReadMedia } = await import(pathToFileURL(resolve(root, 'backend/dist/src/permissions.js')).href);
  const candidates = [...new Set(rows.flatMap(row => [row.fileUrl, row.pdfUrl, row.coverUrl]))]
    .filter(value => typeof value === 'string' && value.startsWith('/media/'));
  let privateMedia = 0;
  let videoRange = 0;
  for (const url of candidates) {
    if (!await canReadMedia(db, a.user, url.slice(6))) continue;
    if (/\.mp4$/i.test(url)) {
      const result = status(await request(url, { cookie: a.cookie, headers: { Range: 'bytes=0-63' } }), 206, 'Video byte range');
      assert.equal(result.bytes.length, 64);
      assert.ok(result.headers['content-range']);
      videoRange++;
    }
    if (!await canReadMedia(db, b.user, url.slice(6))) {
      status(await request(url, { cookie: a.cookie }), 200, 'Granted local media');
      status(await request(url, { cookie: b.cookie }), 404, 'Cross-project media');
      status(await request(url), 401, 'Unauthenticated media');
      privateMedia++;
    }
    if (privateMedia && videoRange) break;
  }
  assert.ok(privateMedia > 0 && videoRange > 0, 'Private media and a local MP4 must be verified');
  checks++;
  status(await request(`/api/admin/users/${a.userId}/projects`, { method: 'PUT', cookie: adminCookie,
    body: { projectIds: [] } }), 200, 'Revoke project');
  status(await request(`/api/contents/${projectA.id}`, { cookie: a.cookie }), 404, 'Revocation is immediate');
  status(await request('/api/auth/logout', { method: 'POST', cookie: b.cookie, body: {} }), 200, 'Logout');
  status(await request('/api/auth/me', { cookie: b.cookie }), 401, 'Logged-out session is revoked');
  console.log(JSON.stringify({ ok: true, checks, contentCount: rows.length, projectCount: projects.length,
    originalUserCount: initialUsers, privateMediaChecks: privateMedia, videoRangeChecks: videoRange }));
} catch (error) {
  // Never serialize HTTP bodies, cookies, generated credentials or database records.
  console.error(`Production verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  const users = await db.user.findMany({ where: { username: { in: usernames } }, select: { id: true } });
  await db.accessLog.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
  await db.user.deleteMany({ where: { username: { in: usernames } } });
  console.log(`Removed ${users.length} temporary verification accounts and their sessions, grants and logs.`);
  await db.$disconnect();
}
