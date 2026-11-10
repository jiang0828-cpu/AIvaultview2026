import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProject,
  professionalModuleTarget,
  projectFolder,
  projectStats,
} from "../src/projectNavigation.js";
import { filterProjects, readProjectFilters } from "../src/projectFilters.js";
import type { Content } from "../src/types.js";

function node(id: number, overrides: Partial<Content> = {}): Content {
  return {
    id,
    title: "Folder",
    type: "folder",
    scene: "life",
    topics: ["family"],
    description: "",
    parentId: null,
    sortOrder: 0,
    children: [],
    coverUrl: null,
    fileUrl: null,
    hlsUrl: null,
    pdfUrl: null,
    imagesJson: null,
    createdAt: "2026-11-10T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
    ...overrides,
  };
}
test("recognizes castle only in life without promoting ordinary folders", () => {
  assert.equal(isProject(node(1, { title: "爱的城堡" })), true);
  assert.equal(isProject(node(2, { title: "爱的城堡", scene: "work" })), false);
  assert.equal(isProject(node(3)), false);
  assert.equal(
    isProject(node(4, { title: "项目04｜AI", scene: "tools" })),
    true,
  );
});
test("folder resolution is limited to descendant folders of the chosen project", () => {
  const nested = node(3);
  const document = node(4, { type: "text" });
  const project = node(1, {
    children: [node(2, { children: [nested, document] })],
  });
  assert.equal(projectFolder(project, 2)?.id, 2);
  assert.equal(projectFolder(project, 3)?.id, 3);
  for (const id of [null, 1, 4, 999])
    assert.equal(projectFolder(project, id), null);
  assert.equal(projectFolder(node(8, { children: [node(9)] }), 2), null);
});
test("recursive counts exclude folders from documents and display formats", () => {
  const project = node(1, {
    children: [
      node(2, {
        children: [node(3, { type: "text" }), node(4, { type: "pdf" })],
      }),
      node(5),
    ],
  });
  assert.deepEqual(projectStats(project), {
    folders: 2,
    documents: 2,
    formats: 2,
  });
  assert.deepEqual(projectStats(node(8)), {
    folders: 0,
    documents: 0,
    formats: 0,
  });
});
test("professional module target opens the first document inside a module folder", () => {
  const folder = node(20, {
    title: "成长计划",
    children: [node(21, { type: "text", title: "成长计划看板" })],
  });
  assert.equal(professionalModuleTarget(folder)?.id, 21);
  const text = node(22, { type: "text", title: "专业成长记录" });
  assert.equal(professionalModuleTarget(text)?.id, 22);
  assert.equal(professionalModuleTarget(undefined), null);
});
test("castle participates in project name search and life filtering", () => {
  const castle = node(1, { title: "爱的城堡" });
  const projects = [
    castle,
    node(2, { title: "项目04｜AI", scene: "tools" }),
  ].filter(isProject);
  assert.deepEqual(
    filterProjects(
      projects,
      readProjectFilters(new URLSearchParams("q=爱的城堡&scene=life")),
    ).map((item) => item.id),
    [1],
  );
  assert.deepEqual(
    filterProjects(
      projects,
      readProjectFilters(new URLSearchParams("q=爱的城堡&scene=work")),
    ),
    [],
  );
});
