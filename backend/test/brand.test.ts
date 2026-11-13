import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("brand migration updates legacy documents and keeps VaultView, identifiers and timestamps", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE Content (id INTEGER PRIMARY KEY, title TEXT, description TEXT, updatedAt TEXT);
      CREATE TABLE LiteraryWriter (id TEXT PRIMARY KEY, data TEXT, updatedAt TEXT);`);
    db.prepare("INSERT INTO Content VALUES (?, ?, ?, ?)").run(7, "欢迎来到藏览", "藏览 / VaultView；保留正文", "2026-11-10T01:02:03Z");
    db.prepare("INSERT INTO Content VALUES (?, ?, ?, ?)").run(8, "普通项目", "原有资料", "2026-11-09T01:02:03Z");
    db.prepare("INSERT INTO LiteraryWriter VALUES (?, ?, ?)").run("writer-1", JSON.stringify({ summary: "藏览 / VaultView", sources: ["https://example.org"] }), "2026-11-10T01:02:03Z");
    const migrations = ["202611110001_brand_guanlan", "202611110002_preserve_english_brand"];
    const migrate = () => migrations.forEach(name => db.exec(readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8")));
    migrate();
    migrate();
    const content = db.prepare("SELECT * FROM Content WHERE id = 7").get();
    assert.equal(content?.title, "欢迎来到观澜");
    assert.equal(content?.description, "观澜 / VaultView；保留正文");
    assert.equal(content?.updatedAt, "2026-11-10T01:02:03Z");
    assert.equal(db.prepare("SELECT description FROM Content WHERE id = 8").get()?.description, "原有资料");
    const writer = db.prepare("SELECT * FROM LiteraryWriter WHERE id = 'writer-1'").get();
    assert.deepEqual(JSON.parse(String(writer?.data)), { summary: "观澜 / VaultView", sources: ["https://example.org"] });
    assert.equal(writer?.updatedAt, "2026-11-10T01:02:03Z");
  } finally { db.close(); }
});
