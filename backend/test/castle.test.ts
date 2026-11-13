import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { projectRoot } from "../src/config.js";
import { seedTestUsers, type TestConfig } from './helpers.js';
import { createApp } from "../src/app.js";
import { seedCastle } from "../prisma/seed-castle.js";
import { castleProject } from "../prisma/castle.js";
import { seedEnglish } from "../prisma/seed-english.js";
import { ensureLearningBasics } from "../prisma/learning-basics.js";

let directory: string;
let db: PrismaClient;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "castle-tests-"));
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
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("castle seed creates current sections and English materials, preserves edits and repairs missing templates", async () => {
  const unrelated = await db.content.create({
    data: {
      title: "Existing project",
      type: "folder",
      description: "Keep this",
    },
  });
  const id = await seedCastle(db);
  const project = await db.content.findUniqueOrThrow({
    where: { id },
    include: {
      parent: true,
      children: {
        orderBy: { sortOrder: "asc" },
        include: { children: { include: { children: true } } },
      },
    },
  });
  assert.equal(project.title, "日常生活 | 学 | 德智体美用");
  assert.equal(project.parent?.title, "生活场景");
  assert.equal(project.scene, "life");
  assert.deepEqual(project.children.map(item => item.title), ["基本信息", "通识", "专业", "运动"]);
  assert.deepEqual(
    project.children.map((item) => item.title),
    castleProject.sections.map((section) => section.title),
  );
  const professional = project.children.find(item => item.title === "专业")!;
  assert.ok(professional);
  const general = project.children.find(item => item.title === "通识")!;
  assert.ok(general.children.some(item => item.title === "英语学习及实战"));
  assert.equal(general.children.some(item => item.title === "通识学习与阅读笔记"), false);
  assert.deepEqual(
    professional.children.filter((item) => item.type === "folder").map((item) => item.title),
    ["成长计划", "阶段方案", "成果展示"],
  );
  const professionalFolders = professional.children.filter((item) => item.type === "folder");
  for (const document of [professional.children[0], ...professionalFolders.map((item) => item.children[0])]) {
    assert.ok(document.description.includes("下一") || document.description.includes("复盘"));
  }
  for (const [index, folder] of project.children.entries()) {
    assert.equal(folder.type, "folder");
    assert.equal(folder.sortOrder, index);
    assert.equal(folder.children.length, folder.title === "专业" ? 7 : 1);
    if (!castleProject.sections[index].documentTitle) continue;
    assert.equal(folder.children[0].type, "text");
    assert.equal(
      folder.children[0].title,
      castleProject.sections[index].documentTitle,
    );
    assert.equal(folder.children[0].scene, "life");
    assert.deepEqual(
      folder.children[0].topics,
      castleProject.sections[index].topics,
    );
    assert.match(folder.children[0].description, /\| ---/);
    if (folder.title === "专业") {
      const sectionFolders = folder.children.filter((item) => item.type === "folder");
      assert.match(folder.children[0].description, /双螺旋过程/);
      assert.match(folder.children[0].description, /技术向善检查/);
      assert.deepEqual(
        sectionFolders.map((item) => item.title),
        ["成长计划", "阶段方案", "成果展示"],
      );
      for (const subfolder of sectionFolders) {
        assert.equal(subfolder.type, "folder");
        assert.ok(subfolder.children.length >= 4);
        assert.equal(subfolder.children[0].type, "text");
      }
      assert.match(sectionFolders[0].children[0].description, /本周三步棋/);
      assert.match(sectionFolders[1].children[0].description, /启蒙.*筑基.*进阶.*实战.*迁移/s);
      assert.match(sectionFolders[2].children[0].description, /证据清单/);
      assert.ok(sectionFolders[0].children.some((item) => /12\s*周/.test(item.title)));
      assert.ok(sectionFolders[0].children.some((item) => item.title.includes("Code 1")));
      assert.ok(sectionFolders[2].children.some((item) => item.title.includes("评分量规")));
    }
  }
  const edited = professional.children[0];
  await db.content.update({
    where: { id: edited.id },
    data: { description: "User revision", sortOrder: 7 },
  });
  const count = await db.content.count();
  await db.content.update({ where: { id }, data: { title: "爱的城堡", topics: ["临时性", "family", "life"] } });
  assert.equal(await seedCastle(db), id);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id } })).title, castleProject.title);
  assert.deepEqual((await db.content.findUniqueOrThrow({ where: { id } })).topics, ["临时性", "family", "life"]);
  assert.equal(await db.content.count(), count);
  const kept = await db.content.findUniqueOrThrow({ where: { id: edited.id } });
  assert.equal(kept.description, "User revision");
  assert.equal(kept.sortOrder, 7);
  assert.equal(
    (await db.content.findUniqueOrThrow({ where: { id: unrelated.id } }))
      .description,
    "Keep this",
  );
  await db.content.delete({
    where: { id: project.children.find(item => item.title === "运动")!.children[0].id },
  });
  await seedCastle(db);
  assert.equal(await db.content.count(), count);
});

test("targeted basic-information initialization preserves edits and does not recreate or change learning content", async () => {
  const project = await db.content.findFirstOrThrow({ where: { title: castleProject.title, isProject: true } });
  const before = await db.content.findMany({ where: { parentId: project.id }, orderBy: { sortOrder: "asc" } });
  const baseline = await db.$transaction(tx => ensureLearningBasics(tx, project.id));
  const original = await db.content.findUniqueOrThrow({ where: { id: baseline.documentId } });
  await db.content.update({ where: { id: original.id }, data: { title: "我的基本信息", description: "<!-- LEARNING_BASELINE_V1 -->\n本人已编辑，不覆盖。" } });
  const count = await db.content.count();
  assert.deepEqual(await db.$transaction(tx => ensureLearningBasics(tx, project.id)), baseline);
  await seedCastle(db);
  assert.equal(await db.content.count(), count);
  const kept = await db.content.findUniqueOrThrow({ where: { id: original.id } });
  assert.equal(kept.description, "<!-- LEARNING_BASELINE_V1 -->\n本人已编辑，不覆盖。");
  for (const folder of before.filter(item => item.title !== "基本信息")) {
    const after = await db.content.findUniqueOrThrow({ where: { id: folder.id } });
    assert.equal(after.description, folder.description);
    assert.equal(after.parentId, folder.parentId);
  }
});

test("English seed preserves edited lessons and restores missing lessons without creating separate access grants", async () => {
  const seeded = await seedEnglish(db);
  assert.equal(seeded.created, 0);
  const project = await db.content.findUniqueOrThrow({ where: { id: seeded.projectId }, include: { children: true } });
  assert.equal(project.isProject, false);
  assert.equal(project.children.length, 6);
  const [edited, removed] = project.children;
  await db.content.update({ where: { id: edited.id }, data: { description: "My English lesson", sortOrder: 99 } });
  await db.content.delete({ where: { id: removed.id } });
  assert.equal((await seedEnglish(db)).created, 1);
  assert.equal((await seedEnglish(db)).created, 0);
  assert.equal(await db.content.count({ where: { parentId: seeded.projectId } }), 6);
  const retained = await db.content.findUniqueOrThrow({ where: { id: edited.id } });
  assert.equal(retained.description, "My English lesson");
  assert.equal(retained.sortOrder, 99);
});

test("castle tree is authenticated and administrators can edit templates and add section materials", async () => {
  const config: TestConfig = {
    adminUsername: 'admin',
    secret: "castle-tests-long-secret-at-least-32-characters",
    sitePassword: "test-site",
    adminPassword: "test-admin",
    siteHashed: false,
    adminHashed: false,
    production: false,
    origin: "http://localhost:5173",
  };
  await seedTestUsers(db, config);
  const app = createApp(db, config);
  await request(app).get("/api/contents").expect(401);
  const visitor = request.agent(app);
  await visitor
    .post("/api/auth/login")
    .send({ username: 'visitor', password: config.sitePassword })
    .expect(200);
  const tree = (await visitor.get("/api/contents").expect(200)).body;
  const scene = tree.find(
    (item: { title: string }) => item.title === "生活场景",
  );
  const project = scene.children.find(
    (item: { title: string }) => item.title === castleProject.title,
  );
  assert.equal(project.children.length, castleProject.sections.length);
  const folder = project.children.find((item: { title: string }) => item.title === "通识");
  const baseline = project.children.find((item: { title: string }) => item.title === "基本信息").children[0];
  await visitor.get(`/api/contents/${baseline.id}`).expect(200);
  await visitor.put(`/api/contents/${baseline.id}`).send({ title: baseline.title, type: "text", description: "Denied" }).expect(403);
  const english = folder.children.find((item: { title: string }) => item.title === "英语学习及实战");
  assert.ok(english);
  await visitor.get(`/api/contents/${english.children[0].id}`).expect(200);
  const visitorUser = await db.user.findUniqueOrThrow({ where: { username: "visitor" } });
  await db.projectAccess.delete({ where: { userId_projectId: { userId: visitorUser.id, projectId: project.id } } });
  await visitor.get(`/api/contents/${english.id}`).expect(404);
  await visitor.get(`/api/contents/${english.children[0].id}`).expect(404);
  await visitor.get(`/api/contents/${baseline.id}`).expect(404);
  await db.projectAccess.create({ data: { userId: visitorUser.id, projectId: project.id } });
  const template = english.children[0];
  await visitor
    .post("/api/contents")
    .send({ title: "Denied", type: "text", parentId: folder.id })
    .expect(403);
  await visitor
    .put(`/api/contents/${template.id}`)
    .send({ title: template.title, type: "text" })
    .expect(403);
  await visitor.delete(`/api/contents/${template.id}`).send({}).expect(403);
  const admin = request.agent(app);
  await admin
    .post("/api/auth/login")
    .send({ password: config.adminPassword, username: "admin" })
    .expect(200);
  await admin.put(`/api/contents/${baseline.id}`).send({ title: baseline.title, type: "text", parentId: baseline.parentId,
    topics: ["family", "planning"], description: "<!-- LEARNING_BASELINE_V1 -->\n# 已确认的基本信息\n仅安排周末。" }).expect(200);
  assert.match((await visitor.get(`/api/contents/${baseline.id}`).expect(200)).body.description, /仅安排周末/);
  await admin
    .put(`/api/contents/${template.id}`)
    .send({
      title: template.title,
      type: "text",
      description: "# Updated plan",
      parentId: english.id,
      topics: ["family", "planning"],
    })
    .expect(200);
  assert.equal(
    (await visitor.get(`/api/contents/${template.id}`).expect(200)).body
      .description,
    "# Updated plan",
  );
  const row = (
    await admin
      .post("/api/contents")
      .send({
        title: "New note",
        type: "text",
        parentId: folder.id,
        topics: ["family"],
        scene: "other",
        sortOrder: 20,
      })
      .expect(201)
  ).body;
  assert.equal(row.scene, "life");
  await admin.delete(`/api/contents/${row.id}`).send({}).expect(204);
});
