import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app.js";
import { projectRoot } from "../src/config.js";
import { seedTestUsers, type TestConfig } from "./helpers.js";

const config: TestConfig = {
  adminUsername: "admin",
  secret: "trip-tests-only-secret-at-least-32-characters",
  sitePassword: "trip-test-reader-password",
  siteHashed: false,
  adminPassword: "trip-test-admin-password",
  adminHashed: false,
  production: false,
  origin: "http://localhost:5173",
};
let directory: string;
let db: PrismaClient;
let app: ReturnType<typeof createApp>;
let projectId: number;
const trip = {
  title: "扬州秋游",
  destination: "扬州 · 瘦西湖",
  startDate: "2026-11-14",
  endDate: "2026-11-15",
  status: "planned",
  transport: "高铁接公交",
  companions: "家人",
  budget: 123456,
  actualSpent: null,
  itinerary: [
    { date: "2026-11-14", title: "瘦西湖", detail: "上午入园，下午游览老城" },
  ],
  notes: "提前预约，带雨具",
};
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "vault-trips-"));
  const url = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  execFileSync(
    process.execPath,
    [resolve(projectRoot, "backend/prisma/migrate.mjs")],
    {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
      windowsHide: true,
    },
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  await db.$connect();
});
beforeEach(async () => {
  await db.user.deleteMany();
  await db.content.updateMany({ data: { parentId: null } });
  await db.content.deleteMany();
  projectId = (
    await db.content.create({
      data: { title: "南京周边游", type: "folder", isProject: true },
    })
  ).id;
  await seedTestUsers(db, config);
  app = createApp(db, config);
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function login(username = "visitor", target = app) {
  const agent = request.agent(target);
  await agent
    .post("/api/auth/login")
    .send({
      username,
      password:
        username === "admin" ? config.adminPassword : config.sitePassword,
    })
    .expect(200);
  return agent;
}

test("visitor owns persistent trip CRUD including itinerary, notes and exact cents", async () => {
  const reader = await login();
  const created = (
    await reader
      .post("/api/trip-plans")
      .send({ ...trip, projectId })
      .expect(201)
  ).body;
  assert.equal(created.budget, 123456);
  const restarted = await login("visitor", createApp(db, config));
  const rows = (
    await restarted.get(`/api/trip-plans?projectId=${projectId}`).expect(200)
  ).body;
  assert.equal(rows[0].id, created.id);
  assert.deepEqual(rows[0].itinerary, trip.itinerary);
  await restarted
    .put(`/api/trip-plans/${created.id}`)
    .send({
      ...trip,
      status: "completed",
      actualSpent: 119999,
      notes: "雨后风景很好",
    })
    .expect(200);
  const updated = (
    await restarted.get(`/api/trip-plans?projectId=${projectId}`).expect(200)
  ).body[0];
  assert.equal(updated.status, "completed");
  assert.equal(updated.actualSpent, 119999);
  assert.equal(updated.notes, "雨后风景很好");
  await restarted.delete(`/api/trip-plans/${created.id}`).send({}).expect(204);
  assert.deepEqual(
    (await restarted.get(`/api/trip-plans?projectId=${projectId}`)).body,
    [],
  );
});
test("other readers and administrators cannot read, overwrite or delete personal trips", async () => {
  const reader = await login();
  const id = (await reader.post("/api/trip-plans").send({ ...trip, projectId }))
    .body.id;
  const user = await db.user.create({
    data: {
      username: "reader2",
      passwordHash: await bcrypt.hash(config.sitePassword, 4),
      mustChangePassword: false,
    },
  });
  await db.projectAccess.create({ data: { userId: user.id, projectId } });
  for (const username of ["reader2", "admin"]) {
    const other = await login(username);
    assert.deepEqual(
      (await other.get(`/api/trip-plans?projectId=${projectId}`).expect(200))
        .body,
      [],
    );
    await other.put(`/api/trip-plans/${id}`).send(trip).expect(404);
    await other.delete(`/api/trip-plans/${id}`).send({}).expect(404);
  }
  assert.equal(await db.tripPlan.count(), 1);
});
test("authentication and current project grants protect every trip operation", async () => {
  await request(app).get(`/api/trip-plans?projectId=${projectId}`).expect(401);
  const reader = await login();
  const id = (await reader.post("/api/trip-plans").send({ ...trip, projectId }))
    .body.id;
  await db.projectAccess.deleteMany();
  await reader.get(`/api/trip-plans?projectId=${projectId}`).expect(404);
  await reader
    .post("/api/trip-plans")
    .send({ ...trip, projectId })
    .expect(404);
  await reader.put(`/api/trip-plans/${id}`).send(trip).expect(404);
  await reader.delete(`/api/trip-plans/${id}`).send({}).expect(404);
  assert.equal(await db.tripPlan.count(), 1);
});
test("validates real dates, chronological range, day dates, amounts and ownership fields", async () => {
  const reader = await login();
  for (const input of [
    { startDate: "2026-02-30" },
    { endDate: "2026-11-13" },
    { startDate: "tomorrow" },
    { budget: -1 },
    { budget: 1.5 },
    { actualSpent: 2147483648 },
    { title: "  " },
    { userId: 1 },
    { itinerary: [{ date: "2026-11-16", title: "越界", detail: "" }] },
  ]) {
    await reader
      .post("/api/trip-plans")
      .send({ ...trip, projectId, ...input })
      .expect(400);
  }
  const child = await db.content.create({
    data: { type: "text", title: "旅行说明", parentId: projectId },
  });
  await reader
    .post("/api/trip-plans")
    .send({ ...trip, projectId: child.id })
    .expect(400);
  assert.equal(await db.tripPlan.count(), 0);
});

test("content management cannot silently remove a project with personal arrangements", async () => {
  const reader = await login();
  await reader
    .post("/api/trip-plans")
    .send({ ...trip, projectId })
    .expect(201);
  const admin = await login("admin");
  await admin.delete(`/api/contents/${projectId}`).send({}).expect(409);
  await admin
    .put(`/api/contents/${projectId}`)
    .send({ title: "旅行目录", type: "folder", isProject: false })
    .expect(409);
  assert.equal(await db.tripPlan.count(), 1);
  assert.equal(
    (await db.content.findUniqueOrThrow({ where: { id: projectId } }))
      .isProject,
    true,
  );
});
