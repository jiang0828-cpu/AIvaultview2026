import "../src/config.js";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { projectRoot } from "../src/config.js";
import { secondTrainingProject } from "./ai-training-second.js";

const db = new PrismaClient();
try {
  const mediaDirectory = resolve(projectRoot, "backend/media/cases/ai/phase-2");
  await mkdir(mediaDirectory, { recursive: true });
  await copyFile(
    resolve(projectRoot, "backend/prisma/curriculum/ai-phase-two.md"),
    resolve(mediaDirectory, "course.md"),
  );
  const result = await db.$transaction(async (tx) => {
    const root = await tx.content.findFirst({
      where: {
        title: "工具方法",
        scene: "tools",
        type: "folder",
        parentId: null,
      },
    });
    if (!root) throw new Error("工具方法模块尚未初始化，请先运行项目 setup。");
    const { children = [], ...data } = secondTrainingProject;
    const existing = await tx.content.findFirst({
      where: { title: data.title, parentId: root.id, type: "folder" },
    });
    const projectData = { ...data, isProject: true, parentId: root.id };
    const project = existing
      ? await tx.content.update({
          where: { id: existing.id },
          data: projectData,
        })
      : await tx.content.create({ data: projectData });
    for (const child of children) {
      const { children: nested, ...contentData } = child;
      if (nested?.length) throw new Error("第二期课程只支持一层展示入口。");
      const row = await tx.content.findFirst({
        where: { title: child.title, parentId: project.id },
      });
      const itemData = {
        ...contentData,
        isProject: false,
        parentId: project.id,
      };
      if (row)
        await tx.content.update({ where: { id: row.id }, data: itemData });
      else await tx.content.create({ data: itemData });
    }
    return { projectId: project.id, entries: children.length };
  });
  console.log(JSON.stringify(result));
} finally {
  await db.$disconnect();
}
