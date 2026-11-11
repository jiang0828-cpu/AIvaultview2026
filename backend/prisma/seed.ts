import "../src/config.js";
import { PrismaClient } from "@prisma/client";
import { caseProjects, type CaseNode } from "./cases.js";
import { seedLiterature } from "./seed-literature.js";
import { seedWorld } from "./seed-world.js";
import { seedWriters } from "./seed-writers.js";
import { seedCastle } from "./seed-castle.js";
import { hasProjectCycle } from "../src/projectTags.js";
const db = new PrismaClient();
const scenes = [
  ["system", "系统管理"],
  ["tools", "工具方法"],
  ["life", "生活场景"],
  ["work", "事业工作"],
  ["hobbies", "兴趣爱好"],
  ["other", "其他模块"],
] as const;
async function ensureCaseNode(node: CaseNode, parentId: number) {
  const existing = await db.content.findFirst({
    where: { title: node.title, parentId, scene: node.scene },
  });
  const data = {
    title: node.title,
    type: node.type,
    scene: node.scene,
    topics: node.type === "folder" && existing && hasProjectCycle(existing.topics)
      ? existing.topics : node.topics,
    imagesJson: node.imagesJson,
    coverUrl: node.coverUrl,
    fileUrl: node.fileUrl,
    description: node.description || "",
    sortOrder: node.sortOrder,
    parentId,
  };
  const record = existing
    ? await db.content.update({ where: { id: existing.id }, data })
    : await db.content.create({ data });
  for (const child of node.children || [])
    await ensureCaseNode(child, record.id);
}
async function consolidateAiCourse() {
  const project = await db.content.findFirst({
    where: {
      title: "项目04｜AI 使用技能及技巧分享｜系列课程",
      type: "folder",
    },
  });
  if (!project) return;
  const document = await db.content.findFirst({
    where: {
      parentId: project.id,
      title: "课程文档｜AI 使用技能及技巧分享完整讲义",
      type: "text",
    },
  });
  if (!document) return;
  const sections = await db.content.findMany({
    where: {
      parentId: project.id,
      type: "text",
      id: { not: document.id },
    },
    orderBy: { sortOrder: "asc" },
  });
  const marker = "<!-- AI_COURSE_SECTIONS -->";
  if (sections.length && !document.description.includes(marker)) {
    const merged = sections
      .map((section) => `## ${section.title}\n\n${section.description}`)
      .join("\n\n---\n\n");
    await db.content.update({
      where: { id: document.id },
      data: {
        description: `${document.description}\n\n${marker}\n\n${merged}`,
        updatedAt: new Date(),
      },
    });
  }
  if (sections.length)
    await db.content.deleteMany({
      where: { id: { in: sections.map((section) => section.id) } },
    });
}
try {
  if ((await db.content.count()) === 0) {
    await db.content.create({
      data: {
        title: "开始探索",
        type: "folder",
        sortOrder: 0,
        children: {
          create: [
            {
              title: "欢迎来到藏览",
              type: "text",
              scene: "other",
              topics: ["other"],
              sortOrder: 0,
              coverUrl: "/media/demo/cover.png",
              description:
                "# 为值得留下的内容，留一个位置\n\n有些内容，值得反复打开。一次分享、一套笔记，或是某个恰好启发你的瞬间。\n\n藏览是这些资料的共同归处，也是一扇可以对外展示的内容窗口。\n\n## 从这里开始\n\n- **观看**：打开视频，回到分享现场。\n- **翻阅**：一页一页，梳理思路。\n- **阅读**：把注意力留给内容本身。\n\n> 收藏的意义，不是拥有更多，而是在需要时，找得到。\n\n这是一份本地示例资料，可由管理员替换。",
            },
            {
              title: "资料库导览",
              type: "video",
              scene: "other",
              topics: ["other"],
              sortOrder: 1,
              description:
                "一段本地演示短片。让每一次打开，都更接近你需要的内容。",
              coverUrl: "/media/demo/cover.png",
              fileUrl: "/media/demo/intro.mp4",
            },
          ],
        },
      },
    });
    await db.content.create({
      data: {
        title: "灵感与方法",
        type: "folder",
        sortOrder: 1,
        children: {
          create: [
            {
              title: "构建你的知识收藏",
              type: "ppt",
              scene: "other",
              topics: ["tools", "business"],
              sortOrder: 0,
              description: "从收集、整理到再次发现，建立自己的资料秩序。",
              coverUrl: "/media/demo/slide-1.png",
              imagesJson: [
                "/media/demo/slide-1.png",
                "/media/demo/slide-2.png",
                "/media/demo/slide-3.png",
              ],
            },
            {
              title: "整理工作手册",
              type: "pdf",
              scene: "other",
              topics: ["tools"],
              sortOrder: 1,
              description: "一份简短的本地 PDF 示例文档。",
              coverUrl: "/media/demo/slide-2.png",
              pdfUrl: "/media/demo/guide.pdf",
            },
            {
              title: "让资料更容易被找到",
              type: "text",
              scene: "other",
              topics: ["tools"],
              sortOrder: 2,
              description:
                "# 让资料更容易被找到\n\n好的整理，是为下一次使用做准备。\n\n## 命名\n\n用具体的标题描述内容，保留时间、主题和版本等必要信息。\n\n## 分类\n\n围绕实际使用场景建立目录。层级不必很深，含义必须清楚。\n\n## 回顾\n\n定期回看收藏，删去过时版本，补上自己的理解。\n\n---\n\n从一个目录开始，让秩序慢慢生长。",
            },
          ],
        },
      },
    });
    console.log("Demo content seeded.");
  } else console.log("Existing content kept; seed skipped.");
  const existingRoots = await db.content.findMany({
    where: { parentId: null, type: "folder" },
    orderBy: { id: "asc" },
  });
  const roots = new Map<string, { id: number }>();
  for (const [key, title] of scenes) {
    const found = existingRoots.find(
      (root) => root.scene === key && root.title === title,
    );
    const root =
      found ??
      (await db.content.create({
        data: {
          title,
          type: "folder",
          scene: key,
          sortOrder: scenes.findIndex(([scene]) => scene === key),
        },
      }));
    roots.set(key, root);
  }
  const otherRoot = roots.get("other")!;
  for (const root of existingRoots) {
    if (root.id !== otherRoot.id && root.scene === "other") {
      await db.content.update({
        where: { id: root.id },
        data: { parentId: otherRoot.id, scene: "other" },
      });
    }
  }
  const untagged = await db.content.findMany({
    where: { type: { not: "folder" } },
    select: { id: true, topics: true },
  });
  for (const item of untagged) {
    if (item.topics === null)
      await db.content.update({
        where: { id: item.id },
        data: { topics: ["other"] },
      });
  }
  const demoTopics: Array<[string, string[]]> = [
    ["欢迎来到藏览", ["system"]],
    ["资料库导览", ["tools", "business"]],
    ["构建你的知识收藏", ["AI", "tools"]],
    ["整理工作手册", ["tools"]],
    ["让资料更容易被找到", ["tools"]],
  ];
  for (const [title, topics] of demoTopics) {
    await db.content.updateMany({ where: { title }, data: { topics } });
  }
  const legacyTravelIntro = await db.content.findMany({
    where: { title: "00 旅行说明｜三小时圈的边界", type: "text" },
    select: { id: true },
  });
  if (legacyTravelIntro.length)
    await db.content.deleteMany({
      where: { id: { in: legacyTravelIntro.map((item) => item.id) } },
    });
  const legacyTravelList = await db.content.findMany({
    where: { title: "01 城市全量清单｜南京南三小时内", type: "text" },
    select: { id: true },
  });
  if (legacyTravelList.length)
    await db.content.deleteMany({
      where: { id: { in: legacyTravelList.map((item) => item.id) } },
    });
  for (const project of caseProjects) {
    const sceneRoot = roots.get(project.scene);
    if (sceneRoot) await ensureCaseNode(project, sceneRoot.id);
  }
  await consolidateAiCourse();
  await seedWriters(db, await seedLiterature(db));
  await seedCastle(db);
  await seedWorld(db);
  console.log("Six scene modules are ready.");
} finally {
  await db.$disconnect();
}
