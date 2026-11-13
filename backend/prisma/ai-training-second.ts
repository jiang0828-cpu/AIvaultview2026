import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot } from "../src/config.js";
import type { CaseNode } from "./cases.js";

export const secondCourseTitle =
  "AI应用 | 第二期：少花 Token，多干活｜AI 工作效率训练营";
export const secondCourseDocument = readFileSync(
  resolve(projectRoot, "backend/prisma/curriculum/ai-phase-two.md"),
  "utf8",
);
const branches = [
  {
    label: "01 省额度",
    color: "#2f7d68",
    items: [
      "看真实用量，区分额度与花费",
      "交接后继续，减少无关历史",
      "同任务比较，质量不退步",
    ],
  },
  {
    label: "02 存做法",
    color: "#4d7691",
    items: [
      "规则、项目状态与 skill 各有归处",
      "给流程配输入、异常与验收",
      "反馈账本记录复发和复测",
    ],
  },
  {
    label: "03 Git",
    color: "#a66f4c",
    items: [
      "本地提交、查看旧版、恢复演练",
      "不提交秘密，不覆盖他人改动",
      "再考虑私有远端与协作权限",
    ],
  },
  {
    label: "04 找工具",
    color: "#75639a",
    items: [
      "按任务选方法，不为工具找用途",
      "装前比较冲突、成本和效果",
      "查官方来源，确认关键值",
    ],
  },
  {
    label: "05 做好看",
    color: "#5c8064",
    items: [
      "风格写成表，先做一页样稿",
      "双端截图，控件实际点击",
      "20/24 且无零分，朗读删空话",
    ],
  },
  {
    label: "06 七天实战",
    color: "#8b6d4a",
    items: [
      "统一周报样例与手算答案",
      "七天完成流程和对比记录",
      "让同事复现，再决定推广",
    ],
  },
];

export const secondTrainingProject: CaseNode = {
  title: secondCourseTitle,
  type: "folder",
  scene: "tools",
  topics: ["长期性", "AI", "learning"],
  sortOrder: 41,
  description:
    "第二期培训：用六个模块和七天实战，把会话、规则、工具与交付质量变成可复用流程。",
  children: [
    {
      title: "思维导图｜第二期 AI 工作效率全景图",
      type: "mindmap",
      scene: "tools",
      topics: ["AI", "mindmap"],
      sortOrder: 0,
      description:
        "第二期课程全景：省额度、存做法、Git、找工具、做好看与七天实战。\n\n<!-- AI_MINDMAP -->\n" +
        JSON.stringify({
          root: "少花 Token，多干活",
          subtitle: "第二期 · 可观察、可复用、可复核的 AI 工作流",
          branches,
        }),
    },
    {
      title: "课程文档｜第二期：少花 Token，多干活完整讲义",
      type: "text",
      scene: "tools",
      topics: ["AI", "learning"],
      sortOrder: 1,
      description: secondCourseDocument,
    },
    {
      title: "课件展示｜第二期原始课件（71页）",
      type: "ppt",
      scene: "tools",
      topics: ["AI", "learning"],
      sortOrder: 2,
      description:
        "来自用户提供的 71 页 PDF。与课程文档逐模块对照；动画占位页为静态画面。\n\n[打开原始 PDF](/media/cases/ai/phase-2/deck.pdf)\n\n[下载第二期完整讲义](/media/cases/ai/phase-2/course.md)",
      assetsJson: [
        "/media/cases/ai/phase-2/deck.pdf",
        "/media/cases/ai/phase-2/course.md",
      ],
      imagesJson: Array.from(
        { length: 71 },
        (_, index) =>
          "/media/cases/ai/phase-2/page-" +
          String(index + 1).padStart(2, "0") +
          ".jpg",
      ),
    },
  ],
};
