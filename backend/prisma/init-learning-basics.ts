import "../src/config.js";
import { PrismaClient } from "@prisma/client";
import { castleProjectTitles } from "../src/castleProjectName.js";
import { ensureLearningBasics } from "./learning-basics.js";

const db = new PrismaClient();
try {
  const projects = await db.content.findMany({ where: { title: { in: castleProjectTitles }, type: "folder", scene: "life", isProject: true } });
  if (projects.length !== 1) throw new Error("Expected exactly one learning project. Initialize or identify the project before adding basic information.");
  const project = projects[0];
  const result = await db.$transaction(tx => ensureLearningBasics(tx, project.id), { timeout: 30000 });
  console.log(JSON.stringify({ projectId: project.id, ...result, url: `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/home?project=${project.id}&folder=${result.folderId}` }));
} finally { await db.$disconnect(); }
