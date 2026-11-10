import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { projectRoot, type AppConfig } from "../src/config.js";

const config: AppConfig = {
  secret: "test-only-jwt-secret-with-at-least-32-characters",
  sitePassword: "test-visitor-password",
  adminPassword: "test-admin-password",
  siteHashed: false,
  adminHashed: false,
  production: false,
  origin: "http://localhost:5173",
};
let directory: string;
let db: PrismaClient;
let app: ReturnType<typeof createApp>;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "yaocang-tests-"));
  const databaseUrl = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  execFileSync(
    process.execPath,
    [resolve(projectRoot, "backend/prisma/migrate.mjs")],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
      windowsHide: true,
    },
  );
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.$connect();
});
beforeEach(async () => {
  await db.accessLog.deleteMany();
  await db.content.updateMany({ data: { parentId: null } });
  await db.content.deleteMany();
  app = createApp(db, config);
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function login(role: "visitor" | "admin" = "visitor", target = app) {
  const agent = request.agent(target);
  await agent
    .post("/api/auth/login")
    .send({
      password: role === "admin" ? config.adminPassword : config.sitePassword,
      role,
    })
    .expect(200);
  return agent;
}

test("login sets 30-day httpOnly strict cookie; session survives requests and logout clears it", async () => {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/login")
    .send({ password: config.sitePassword })
    .expect(200);
  const cookies = String(response.headers["set-cookie"]);
  assert.match(cookies, /HttpOnly/);
  assert.match(cookies, /SameSite=Strict/);
  assert.match(cookies, /Max-Age=2592000/);
  assert.equal(response.body.role, "visitor");
  assert.equal(
    (await agent.get("/api/auth/me").expect(200)).body.role,
    "visitor",
  );
  await agent.post("/api/auth/logout").send({}).expect(200);
  await agent.get("/api/contents").expect(401);
});
test("five invalid logins lock the IP for 15 minutes, across both roles", async () => {
  for (let i = 0; i < 5; i++)
    await request(app)
      .post("/api/auth/login")
      .send({ password: "wrong" })
      .expect(401);
  const response = await request(app)
    .post("/api/auth/login")
    .send({ password: config.adminPassword, role: "admin" })
    .expect(429);
  assert.ok(Number(response.headers["retry-after"]) <= 900);
  assert.ok(Number(response.headers["retry-after"]) > 895);
});
test("successful login resets failed attempts", async () => {
  for (let i = 0; i < 4; i++)
    await request(app)
      .post("/api/auth/login")
      .send({ password: "wrong" })
      .expect(401);
  await login();
  for (let i = 0; i < 4; i++)
    await request(app)
      .post("/api/auth/login")
      .send({ password: "wrong" })
      .expect(401);
  await login();
});
test("bcrypt password support and production secure-cookie flag", async () => {
  const hashed = await bcrypt.hash(config.sitePassword, 4);
  const secureApp = createApp(db, {
    ...config,
    production: true,
    sitePassword: hashed,
    siteHashed: true,
  });
  const response = await request(secureApp)
    .post("/api/auth/login")
    .send({ password: config.sitePassword })
    .expect(200);
  assert.match(String(response.headers["set-cookie"]), /Secure/);
});
test("anonymous requests cannot read content or media; visitor cannot mutate content", async () => {
  await request(app).get("/api/contents").expect(401);
  await request(app).get("/media/demo/cover.png").expect(401);
  const visitor = await login();
  await visitor
    .post("/api/contents")
    .send({ title: "Forbidden", type: "text" })
    .expect(403);
  await visitor
    .put("/api/contents/1")
    .send({ title: "Forbidden", type: "text" })
    .expect(403);
  await visitor.delete("/api/contents/1").send({}).expect(403);
  await request(app)
    .post("/api/auth/login")
    .send({ password: config.sitePassword, role: "admin" })
    .expect(401);
});
test("administrator CRUD persists and returns sorted nested tree", async () => {
  const agent = await login("admin");
  const folder = (
    await agent
      .post("/api/contents")
      .send({ title: "Folder", type: "folder" })
      .expect(201)
  ).body;
  const later = (
    await agent
      .post("/api/contents")
      .send({ title: "Later", type: "text", parentId: folder.id, sortOrder: 5 })
      .expect(201)
  ).body;
  const earlier = (
    await agent
      .post("/api/contents")
      .send({
        title: "Earlier",
        type: "text",
        parentId: folder.id,
        sortOrder: 1,
      })
      .expect(201)
  ).body;
  const tree = (await agent.get("/api/contents").expect(200)).body;
  assert.deepEqual(
    tree[0].children.map((child: { id: number }) => child.id),
    [earlier.id, later.id],
  );
  await agent
    .put(`/api/contents/${earlier.id}`)
    .send({
      title: "Updated",
      type: "text",
      description: "# Updated",
      parentId: folder.id,
    })
    .expect(200);
  assert.equal(
    (await agent.get(`/api/contents/${earlier.id}`).expect(200)).body.title,
    "Updated",
  );
  await agent.delete(`/api/contents/${folder.id}`).send({}).expect(409);
  await agent.delete(`/api/contents/${earlier.id}`).send({}).expect(204);
  await agent.get(`/api/contents/${earlier.id}`).expect(404);
  await agent.delete(`/api/contents/${later.id}`).send({}).expect(204);
  await agent.delete(`/api/contents/${folder.id}`).send({}).expect(204);
});
test("invalid IDs, unsafe URLs, missing media and cyclic/non-folder parents are rejected", async () => {
  const agent = await login("admin");
  await agent.get("/api/contents/nope").expect(400);
  await agent
    .post("/api/contents")
    .send({ title: "", type: "text" })
    .expect(400);
  await agent
    .post("/api/contents")
    .send({ title: "Video", type: "video" })
    .expect(400);
  await agent
    .post("/api/contents")
    .send({ title: "PDF", type: "pdf", pdfUrl: "javascript:alert(1)" })
    .expect(400);
  await agent
    .post("/api/contents")
    .send({ title: "Bad", type: "text", coverUrl: "/media/../.env" })
    .expect(400);
  await agent
    .post("/api/contents")
    .send({ title: "Missing parent", type: "text", parentId: 999999 })
    .expect(400);
  const root = (
    await agent.post("/api/contents").send({ title: "Root", type: "folder" })
  ).body;
  const child = (
    await agent
      .post("/api/contents")
      .send({ title: "Child", type: "folder", parentId: root.id })
  ).body;
  await agent
    .put(`/api/contents/${root.id}`)
    .send({ title: "Cycle", type: "folder", parentId: child.id })
    .expect(400);
  await agent
    .put(`/api/contents/${root.id}`)
    .send({ title: "Not a folder", type: "text" })
    .expect(409);
  const leaf = (
    await agent.post("/api/contents").send({ title: "Leaf", type: "text" })
  ).body;
  await agent
    .post("/api/contents")
    .send({ title: "Bad parent", type: "text", parentId: leaf.id })
    .expect(400);
});
test("topics are limited to three labels and child content inherits its scene", async () => {
  const agent = await login("admin");
  const folder = (
    await agent
      .post("/api/contents")
      .send({ title: "Life folder", type: "folder", scene: "life" })
      .expect(201)
  ).body;
  const child = (
    await agent.post("/api/contents").send({
      title: "Tagged item",
      type: "text",
      scene: "other",
      parentId: folder.id,
      topics: ["health", "food&drink"],
    })
  ).body;
  assert.equal(child.scene, "life");
  assert.deepEqual(child.topics, ["health", "food&drink"]);
  await agent
    .post("/api/contents")
    .send({
      title: "Too many tags",
      type: "text",
      topics: ["AI", "business", "health", "reading"],
    })
    .expect(400);
  await agent
    .post("/api/contents")
    .send({ title: "Bad tag", type: "text", topics: ["food drink"] })
    .expect(400);
});
test("access log persists valid actions and rejects unknown content", async () => {
  const row = await db.content.create({
    data: { title: "Article", type: "text" },
  });
  const agent = await login();
  await agent
    .post("/api/log")
    .send({ contentId: row.id, action: "view_text" })
    .expect(201);
  assert.equal(
    await db.accessLog.count({
      where: { contentId: row.id, action: "view_text" },
    }),
    1,
  );
  await agent
    .post("/api/log")
    .send({ contentId: 999999, action: "view_text" })
    .expect(404);
  await agent
    .post("/api/log")
    .send({ contentId: row.id, action: "something_else" })
    .expect(400);
});
test("long image content can be created and logged", async () => {
  const agent = await login("admin");
  const row = (
    await agent
      .post("/api/contents")
      .send({
        title: "Roadmap long image",
        type: "longimage",
        topics: ["AI"],
        imagesJson: ["/media/cases/ai/course-roadmap.png"],
      })
      .expect(201)
  ).body;
  assert.equal(row.type, "longimage");
  await agent
    .post("/api/log")
    .send({ contentId: row.id, action: "view_longimage" })
    .expect(201);
});
test("mindmap content can be created and logged", async () => {
  const agent = await login("admin");
  const row = (
    await agent
      .post("/api/contents")
      .send({
        title: "AI course mindmap",
        type: "mindmap",
        topics: ["AI", "mindmap"],
        description:
          '<!-- AI_MINDMAP -->\n{"root":"AI","subtitle":"课程","branches":[]}',
      })
      .expect(201)
  ).body;
  assert.equal(row.type, "mindmap");
  await agent
    .post("/api/log")
    .send({ contentId: row.id, action: "view_mindmap" })
    .expect(201);
});
test("cross-origin and non-JSON mutations are rejected; malformed JSON uses standard errors", async () => {
  await request(app)
    .post("/api/auth/login")
    .set("Origin", "https://other.example")
    .send({ password: config.sitePassword })
    .expect(403);
  await request(app)
    .post("/api/auth/login")
    .type("form")
    .send({ password: config.sitePassword })
    .expect(415);
  const response = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send("{")
    .expect(400);
  assert.equal(response.body.error.code, "INVALID_BODY");
});
test("changing configured password invalidates existing sessions", async () => {
  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ password: config.sitePassword });
  const cookie = String(loginResponse.headers["set-cookie"][0]).split(";")[0];
  const changedApp = createApp(db, {
    ...config,
    sitePassword: "changed-test-password",
  });
  await request(changedApp)
    .get("/api/auth/me")
    .set("Cookie", cookie)
    .expect(401);
});
