import type { PrismaClient } from "@prisma/client";
import { castleProject } from "./castle.js";

export async function seedCastle(db: PrismaClient) {
  return db.$transaction(async (tx) => {
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
          topics: castleProject.topics,
          sortOrder: castleProject.sortOrder,
          scene: "life",
          type: "folder",
          parentId: scene.id,
        },
      }));
    project = await tx.content.update({
      where: { id: project.id },
      data: { topics: castleProject.topics },
    });
    for (const [sortOrder, section] of castleProject.sections.entries()) {
      const folder =
        (await tx.content.findFirst({
          where: { title: section.title, parentId: project.id, type: "folder" },
        })) ??
        (await tx.content.create({
          data: {
            title: section.title,
            description: section.summary,
            topics: section.topics,
            type: "folder",
            scene: "life",
            sortOrder,
            parentId: project.id,
          },
        }));
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
    }
    return project.id;
  });
}
