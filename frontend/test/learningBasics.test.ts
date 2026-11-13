import { test } from "node:test";
import assert from "node:assert/strict";
import type { Content } from "../src/types.js";
import { learningBasicsDocument, learningScope, planningReference, visibleBaselineDescription } from "../src/learningBasicsModel.js";

function node(id: number, title: string, children: Content[] = []): Content {
  return { id, title, type: "folder", scene: "life", children, parentId: null, sortOrder: 0, topics: [], description: "",
    coverUrl: null, fileUrl: null, hlsUrl: null, pdfUrl: null, imagesJson: [], createdAt: "2026-11-13", updatedAt: "2026-11-13" };
}
test("all learning modules reference the same current baseline, including nested lessons", () => {
  const document = { ...node(3, "基本信息与安排依据"), type: "text" as const, description: "# 兴趣\n喜欢阅读；周末有空。" };
  const lesson = node(6, "英语学习及实战");
  const project = node(1, "学习项目", [node(2, "基本信息", [document]), node(4, "通识", [lesson]), node(7, "专业"), node(8, "运动")]);
  assert.equal(learningBasicsDocument(project), document);
  assert.equal(learningScope(project, lesson), "通识");
  for (const target of [lesson, project.children![2], project.children![3]]) {
    const reference = planningReference(project, target);
    assert.match(reference, /喜欢阅读；周末有空/);
    assert.match(reference, /完成标准/);
    assert.match(reference, /未确认/);
  }
  document.description = "最新条件：只在周日上午安排。";
  assert.match(planningReference(project, lesson), /只在周日上午/);
  assert.doesNotMatch(planningReference(project, lesson), /喜欢阅读/);
  assert.equal(planningReference(node(20, "Other project"), lesson), "");
});
test("a renamed baseline stays discoverable through its marker without selecting arbitrary documents", () => {
  const profile = { ...node(3, "自定义资料"), type: "text" as const, description: "<!-- LEARNING_BASELINE_V1 -->\n内容" };
  const unrelated = { ...node(4, "普通资料"), type: "text" as const };
  assert.equal(learningBasicsDocument(node(1, "项目", [node(2, "基本信息", [unrelated, profile])])), profile);
  assert.equal(learningBasicsDocument(node(1, "项目", [node(2, "别的板块", [profile])])), undefined);
  assert.equal(visibleBaselineDescription(profile.description), "内容");
  assert.equal(visibleBaselineDescription("普通资料里的 <!-- LEARNING_BASELINE_V1 --> 示例"), "普通资料里的 <!-- LEARNING_BASELINE_V1 --> 示例");
  assert.doesNotMatch(planningReference(node(1, "项目", [node(2, "基本信息", [profile])])), /LEARNING_BASELINE_V1/);
});
