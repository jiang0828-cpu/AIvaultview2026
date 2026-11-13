import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProject,
  professionalModuleTarget,
  projectFolder,
  folderNavigationPath,
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
test("recognizes explicit projects independently of their title or scene", () => {
  assert.equal(isProject(node(1, { title: "爱的城堡", isProject: true })), true);
  assert.equal(isProject(node(2, { title: "爱的城堡", scene: "work" })), false);
  assert.equal(isProject(node(3)), false);
  assert.equal(
    isProject(node(4, { title: "Renamed course", scene: "tools", isProject: true })),
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

test("folder navigation resolves project, nested folder and standalone directory independently", () => {
  const nested = node(3);
  const project = node(1, { title: "项目｜Test", children: [node(2, { children: [nested] })] });
  assert.equal(folderNavigationPath([project], project), "/home?project=1");
  assert.equal(folderNavigationPath([project], nested), "/home?project=1&folder=3");
  assert.equal(folderNavigationPath([project], node(8)), "/home?folder=8");
});

test("world issue title navigates to that issue rather than the latest issue", () => {
  const issue1 = node(11, { scene: "system", description: "<!-- WORLD_ISSUE -->", sortOrder: 1 });
  const issue2 = node(12, { scene: "system", description: "<!-- WORLD_ISSUE -->", sortOrder: 2 });
  const method = node(13, { scene: "system" });
  const world = node(10, { title: "观天下", scene: "system", description: "<!-- WORLD_PROJECT -->", children: [issue1, issue2, method] });
  assert.equal(folderNavigationPath([world], world), "/home?project=10");
  assert.equal(folderNavigationPath([world], issue1), "/home?project=10&issue=11");
  assert.equal(folderNavigationPath([world], issue2), "/home?project=10&issue=12");
  assert.equal(folderNavigationPath([world], method), "/home?project=10&folder=13");
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
  const castle = node(1, { title: "爱的城堡", isProject: true });
  const projects = [
    castle,
    node(2, { title: "项目04｜AI", scene: "tools", isProject: true }),
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
