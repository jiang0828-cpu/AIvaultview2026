import type { PrismaClient } from "@prisma/client";
import { castleProject } from "./castle.js";
import { growthCurriculumDocuments } from "./growth-curriculum.js";
import { hasProjectCycle } from "../src/projectTags.js";
import { ensureEnglishProject } from "./seed-english.js";

export async function seedCastle(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const deleteTree = async (id: number): Promise<void> => {
      const children = await tx.content.findMany({
        where: { parentId: id },
        select: { id: true },
      });
      for (const child of children) await deleteTree(child.id);
      await tx.content.delete({ where: { id } });
    };
    const legacySectionTitles: Record<string, string[]> = {
      通识: ["“求知如”-生而为人（通识）"],
      专业: ["“解构世界”-科技特长（专业）"],
      运动: ["“奔赴热爱”-体育特长（运动）"],
    };
    const obsoleteSectionTitles = [
      "“玩”起来-日程安排（日常）",
      "“愉快假期”家庭游（游乐）",
    ];
    const scene =
      (await tx.content.findFirst({
        where: {
          title: "生活场景",
          scene: "life",
          parentId: null,
          type: "folder",
        },
      })) ??
      (await tx.content.create({
        data: {
          title: "生活场景",
          scene: "life",
          type: "folder",
          sortOrder: 2,
        },
      }));
    let project =
      (await tx.content.findFirst({
        where: {
          title: castleProject.title,
          parentId: scene.id,
          type: "folder",
        },
      })) ??
      (await tx.content.create({
        data: {
          title: castleProject.title,
          description: castleProject.description,
          isProject: true,
          topics: castleProject.topics,
          sortOrder: castleProject.sortOrder,
          scene: "life",
          type: "folder",
          parentId: scene.id,
        },
      }));
    if (!project.isProject) project = await tx.content.update({ where: { id: project.id }, data: { isProject: true } });
    if (!hasProjectCycle(project.topics)) project = await tx.content.update({
      where: { id: project.id },
      data: { topics: castleProject.topics },
    });
    for (const [sortOrder, section] of castleProject.sections.entries()) {
      let folder = await tx.content.findFirst({
        where: { title: section.title, parentId: project.id, type: "folder" },
      });
      let migrated = false;
      if (!folder) {
        for (const legacyTitle of legacySectionTitles[section.title] || []) {
          folder = await tx.content.findFirst({
            where: { title: legacyTitle, parentId: project.id, type: "folder" },
          });
          if (folder) {
            migrated = true;
            break;
          }
        }
      }
      if (!folder) {
        folder = await tx.content.create({
          data: {
            title: section.title,
            description: section.summary,
            topics: section.topics,
            type: "folder",
            scene: "life",
            sortOrder,
            parentId: project.id,
          },
        });
      } else if (migrated) {
        folder = await tx.content.update({
          where: { id: folder.id },
          data: {
            title: section.title,
            description: section.summary,
            topics: section.topics,
            sortOrder,
          },
        });
      } else if (folder.sortOrder !== sortOrder) {
        folder = await tx.content.update({
          where: { id: folder.id },
          data: { sortOrder },
        });
      }
      const document = await tx.content.findFirst({
        where: {
          title: section.documentTitle,
          parentId: folder.id,
          type: "text",
        },
      });
      if (!document)
        await tx.content.create({
          data: {
            title: section.documentTitle,
            description: section.description,
            topics: section.topics,
            type: "text",
            scene: "life",
            sortOrder: 0,
            parentId: folder.id,
          },
        });
      else if (
        "legacyDescription" in section &&
        section.legacyDescription &&
        document.description === section.legacyDescription
      ) {
        await tx.content.update({
          where: { id: document.id },
          data: { description: section.description },
        });
      }
      for (const [extraOrder, extra] of (
        section.additionalSections || []
      ).entries()) {
        const extraFolder =
          (await tx.content.findFirst({
            where: { title: extra.title, parentId: folder.id, type: "folder" },
          })) ??
          (await tx.content.create({
            data: {
              title: extra.title,
              description: extra.summary,
              topics: extra.topics,
              type: "folder",
              scene: "life",
              sortOrder: extraOrder,
              parentId: folder.id,
            },
          }));
        const extraDocument = await tx.content.findFirst({
          where: {
            title: extra.documentTitle,
            parentId: extraFolder.id,
            type: "text",
          },
        });
        if (!extraDocument)
          await tx.content.create({
            data: {
              title: extra.documentTitle,
              description: extra.description,
              topics: extra.topics,
              type: "text",
              scene: "life",
              sortOrder: 0,
              parentId: extraFolder.id,
            },
          });
        else if (
          "legacyDescription" in extra &&
          extra.legacyDescription &&
          extraDocument.description === extra.legacyDescription
        ) {
          await tx.content.update({
            where: { id: extraDocument.id },
            data: { description: extra.description },
          });
        }
      }
      if (section.title === "通识") await ensureEnglishProject(tx, folder.id);
      if (section.title === "专业") {
        const folderForModule = new Map<string, number>([["record", folder.id]]);
        for (const extra of section.additionalSections || []) {
          const extraFolder = await tx.content.findFirst({
            where: { title: extra.title, parentId: folder.id, type: "folder" },
          });
          if (extraFolder) folderForModule.set(extra.title, extraFolder.id);
        }
        const moduleParent = (module: string) =>
          module === "record"
            ? folderForModule.get("record")
            : folderForModule.get(
                module === "plan"
                  ? "成长计划"
                  : module === "stage"
                    ? "阶段方案"
                    : "成果展示",
              );
        const moduleOrder = new Map<string, number>();
        for (const [index, document] of growthCurriculumDocuments.entries()) {
          const parentId = moduleParent(document.module);
          if (!parentId) continue;
          const order = moduleOrder.get(document.module) || 10;
          moduleOrder.set(document.module, order + 1);
          const existing = await tx.content.findFirst({
            where: { title: document.title, parentId, type: "text" },
          });
          if (!existing) {
            await tx.content.create({
              data: {
                title: document.title,
                description: document.description,
                topics: document.topics,
                type: "text",
                scene: "life",
                sortOrder: order + index,
                parentId,
              },
            });
          }
        }
      }
    }
    const obsoleteFolders = await tx.content.findMany({
      where: {
        title: { in: obsoleteSectionTitles },
        parentId: project.id,
        type: "folder",
      },
      select: { id: true },
    });
    for (const folder of obsoleteFolders) await deleteTree(folder.id);
    return project.id;
  });
}
