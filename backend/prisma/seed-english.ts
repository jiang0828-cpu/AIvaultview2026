import type { Prisma, PrismaClient } from "@prisma/client";
import { englishProject, englishProjectMarker } from "./english.js";
import { castleProjectTitles } from "../src/castleProjectName.js";

export async function ensureEnglishProject(tx: Prisma.TransactionClient, generalId: number) {
  const parent = await tx.content.findUniqueOrThrow({ where: { id: generalId }, include: { parent: true } });
  if (parent.type !== "folder" || parent.scene !== "life" || parent.title !== "通识" || !castleProjectTitles.includes(parent.parent?.title || ""))
    throw new Error("English learning must belong to the daily learning project / 通识.");
  const existing = await tx.content.findFirst({ where: { parentId: generalId, type: "folder",
    OR: [{ description: { contains: englishProjectMarker } }, { title: englishProject.title }] } });
  const project = existing || await tx.content.create({ data: {
    title: englishProject.title, description: englishProject.description, topics: [...englishProject.topics],
    sortOrder: englishProject.sortOrder, parentId: generalId, type: "folder", scene: "life",
  } });
  let created = existing ? 0 : 1;
  for (const [sortOrder, document] of englishProject.documents.entries()) {
    if (await tx.content.findFirst({ where: { parentId: project.id, title: document.title, type: document.type } })) continue;
    await tx.content.create({ data: { ...document, topics: [...document.topics], sortOrder, parentId: project.id, scene: "life" } });
    created++;
  }
  return { projectId: project.id, generalId, castleId: parent.parentId!, created };
}

export async function seedEnglish(db: PrismaClient) {
  return db.$transaction(async tx => {
    const castle = await tx.content.findFirstOrThrow({ where: { title: { in: castleProjectTitles }, scene: "life", type: "folder" } });
    const general = await tx.content.findFirstOrThrow({ where: { title: "通识", parentId: castle.id, type: "folder" } });
    return ensureEnglishProject(tx, general.id);
  });
}
