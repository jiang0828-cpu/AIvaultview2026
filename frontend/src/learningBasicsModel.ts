import { flatten, type Content } from "./types.js";

export function visibleBaselineDescription(value: string) {
  return value.replace(/^\s*<!-- LEARNING_BASELINE_V1 -->\s*/, "");
}

export function learningBasicsFolder(project: Content) {
  return project.children?.find(item => item.type === "folder" && item.title === "基本信息");
}
export function learningBasicsDocument(project: Content) {
  return learningBasicsFolder(project)?.children?.find(item => item.type === "text" &&
    (item.title === "基本信息与安排依据" || item.description.includes("<!-- LEARNING_BASELINE_V1 -->")));
}
export function learningScope(project: Content, target?: Content | null) {
  return project.children?.find(section => section.id === target?.id || flatten(section.children || []).some(item => item.id === target?.id))?.title || "学习";
}
export const scopeGuidance: Record<string, string> = {
  通识: "从兴趣与真实问题选主题，按已确认的阅读和表达基础确定内容与任务。",
  专业: "按当前基础选择成长阶段，把目标拆成可完成的实践任务，并约定成果证据。",
  运动: "按本人目标、可用时间和已说明的限制选择活动，写明需要暂停与回顾的条件。",
};
export function planningReference(project: Content, target?: Content | null) {
  const document = learningBasicsDocument(project);
  if (!document) return "";
  const scope = learningScope(project, target);
  return `# ${scope}安排依据\n\n当前内容：${target?.title || scope}\n基本信息版本：${document.updatedAt}\n\n${visibleBaselineDescription(document.description)}\n\n## 本次安排要求\n\n${scopeGuidance[scope] || "通识、专业、运动均参考以上信息安排。"}\n\n- 参考的基本信息条目：\n- 本次目标与任务：\n- 难度、频次、单次时长与可用条件：\n- 完成标准与成果记录：\n- 回顾日期及调整条件：\n\n信息未确认时先列待确认项，不推断年龄、能力、时间或训练量。\n`;
}
