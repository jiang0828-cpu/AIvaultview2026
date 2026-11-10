import assert from "node:assert/strict";
import { test } from "node:test";
import { filterProjects, getProjectMetadata, projectDateKey, projectFilterError, readProjectFilters, type ProjectFilters } from "../src/projectFilters.js";
import { scenes, type Content } from "../src/types.js";

function project(overrides: Partial<Content> = {}): Content {
  return {
    id: 1, title: "Alpha", type: "folder", scene: "work", topics: ["AI"],
    description: "", coverUrl: null, fileUrl: null, hlsUrl: null, pdfUrl: null,
    imagesJson: null, sortOrder: 0, parentId: null, children: [],
    createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z", ...overrides,
  };
}
const defaults = readProjectFilters(new URLSearchParams());
const filters = (overrides: Partial<ProjectFilters> = {}): ProjectFilters => ({ ...defaults, ...overrides });
const ids = (items: Content[]) => items.map((item) => item.id);

test("reads safe defaults and validates URL filter values", () => {
  assert.deepEqual(defaults, { q: "", scene: "", sort: "updatedAt", order: "desc", createdFrom: "", createdTo: "", updatedFrom: "", updatedTo: "" });
  const parsed = readProjectFilters(new URLSearchParams("q=AI&scene=invalid&sort=bad&order=bad&createdFrom=2026-02-30&createdTo=2026-1-1&updatedFrom=2026-11-10"));
  assert.deepEqual(parsed, { ...defaults, q: "AI", updatedFrom: "2026-11-10" });
  assert.deepEqual(readProjectFilters(new URLSearchParams("scene=life&sort=title&order=asc")), { ...defaults, scene: "life", sort: "title", order: "asc" });
});

test("converts timestamps to Beijing dates across midnight", () => {
  assert.equal(projectDateKey("2026-11-01T15:59:59Z"), "2026-11-01");
  assert.equal(projectDateKey("2026-11-01T16:00:00Z"), "2026-11-02");
  assert.equal(projectDateKey("invalid"), "");
});

test("uses latest nested modification and root topics first", () => {
  const root = project({ children: [project({ updatedAt: "2026-11-03T00:00:00Z", topics: ["child"], children: [project({ updatedAt: "2026-11-05T00:00:00Z" })] })] });
  assert.deepEqual(getProjectMetadata(root), { updatedAt: "2026-11-05T00:00:00Z", topics: ["AI"] });
  root.children![0].updatedAt = "invalid";
  assert.equal(getProjectMetadata(root).updatedAt, "2026-11-05T00:00:00Z");
  assert.equal(getProjectMetadata(project({ updatedAt: "invalid", children: [project()] })).updatedAt, "2026-11-02T00:00:00Z");
});

test("falls back to unique child topics with a two-topic limit", () => {
  const metadata = getProjectMetadata(project({ topics: null, children: [project({ topics: ["AI", "AI"] }), project({ topics: ["health", "food"] })] }));
  assert.deepEqual(metadata.topics, ["AI", "health"]);
});

test("combines case-insensitive multiword search, scene and date filters", () => {
  const items = [project({ title: "南京旅行", scene: "life", topics: ["Travel"] }), project({ id: 2, title: "南京旅行", scene: "work" })];
  assert.deepEqual(ids(filterProjects(items, filters({ q: "南京 TRAVEL 生活 2026/11/01", scene: "life", createdFrom: "2026-11-01", updatedTo: "2026-11-02" }))), [1]);
  assert.deepEqual(filterProjects(items, filters({ q: "不存在" })), []);
  assert.deepEqual(ids(filterProjects(items, filters({ q: "   " }))), [1, 2]);
});

test("creation date boundaries are inclusive and allow open ranges", () => {
  const items = [project({ createdAt: "2026-11-01T16:00:00Z" }), project({ id: 2, createdAt: "2026-11-02T15:59:59Z" }), project({ id: 3, createdAt: "2026-11-02T16:00:00Z" })];
  assert.deepEqual(ids(filterProjects(items, filters({ createdFrom: "2026-11-02", createdTo: "2026-11-02" }))), [1, 2]);
  assert.deepEqual(ids(filterProjects(items, filters({ createdFrom: "2026-11-03" }))), [3]);
  assert.deepEqual(ids(filterProjects(items, filters({ createdTo: "2026-11-02" }))), [1, 2]);
});

test("update filters and sorting use the same descendant date as the card", () => {
  const items = [project({ children: [project({ updatedAt: "2026-11-06T16:00:00Z" })] }), project({ id: 2 })];
  assert.deepEqual(ids(filterProjects(items, filters({ updatedFrom: "2026-11-07", updatedTo: "2026-11-07" }))), [1]);
  assert.deepEqual(ids(filterProjects(items, filters({ updatedTo: "2026-11-02" }))), [2]);
  assert.deepEqual(ids(filterProjects(items, filters({ q: "2026-11-07" }))), [1]);
  assert.deepEqual(ids(filterProjects(items, filters())), [1, 2]);
  assert.deepEqual(ids(filterProjects(items, filters({ order: "asc" }))), [2, 1]);
});

test("rejects reversed date ranges with a useful error", () => {
  for (const range of [{ createdFrom: "2026-11-02", createdTo: "2026-11-01" }, { updatedFrom: "2026-11-02", updatedTo: "2026-11-01" }]) {
    const value = filters(range);
    assert.ok(projectFilterError(value));
    assert.deepEqual(filterProjects([project()], value), []);
  }
  assert.equal(projectFilterError(defaults), "");
});

test("sorts creation dates in both directions without mutating input", () => {
  const items = [project(), project({ id: 2, createdAt: "2026-11-03T00:00:00Z" })];
  const original = structuredClone(items);
  assert.deepEqual(ids(filterProjects(items, filters({ sort: "createdAt" }))), [2, 1]);
  assert.deepEqual(ids(filterProjects(items, filters({ sort: "createdAt", order: "asc" }))), [1, 2]);
  assert.deepEqual(items, original);
});

test("sorts displayed project names, ignoring the legacy project prefix", () => {
  const items = [project({ title: "项目01｜Beta" }), project({ id: 2, title: "项目02｜Alpha" })];
  assert.deepEqual(ids(filterProjects(items, filters({ sort: "title", order: "asc" }))), [2, 1]);
  assert.deepEqual(ids(filterProjects(items, filters({ sort: "title", order: "desc" }))), [1, 2]);
});

test("sorts all scene types by their displayed labels in both directions", () => {
  const items = scenes.map((scene, index) => project({ id: index + 1, scene: scene.key }));
  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
  const expected = [...items].sort((a, b) => collator.compare(scenes.find((scene) => scene.key === a.scene)!.label, scenes.find((scene) => scene.key === b.scene)!.label));
  assert.deepEqual(ids(filterProjects(items, filters({ sort: "scene", order: "asc" }))), ids(expected));
  assert.deepEqual(ids(filterProjects(items, filters({ sort: "scene", order: "desc" }))), ids(expected.reverse()));
});

test("invalid dates stay last and equal values have a deterministic order", () => {
  const items = [project({ id: 3, title: "Beta" }), project({ id: 2 }), project(), project({ id: 4, createdAt: "invalid", updatedAt: "invalid" })];
  for (const sort of ["createdAt", "updatedAt"] as const) {
    for (const order of ["asc", "desc"] as const) {
      assert.deepEqual(ids(filterProjects(items, filters({ sort, order }))), [1, 2, 3, 4]);
    }
  }
  assert.deepEqual(ids(filterProjects(items, filters({ createdFrom: "2026-11-01" }))), [1, 2, 3]);
});
