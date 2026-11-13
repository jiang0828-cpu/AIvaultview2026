import { Prisma, type PrismaClient } from '@prisma/client';
import { researchPrompt, researchTaskInput } from '../src/researchSchema.js';
import { researchTaskView } from '../src/research.js';
import { seedResearch } from './seed-research.js';
import { cdxAsOf, cdxGoal, cdxObject, cdxStudyTitle, cdxSynthesis, cdxTasks } from './cdx-market-data.js';

const registryKey = 'research.cdx-market.v1.studyId';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function seedCdxMarket(db: PrismaClient) {
  const project = await seedResearch(db);
  return db.$transaction(async tx => {
    const registered = await tx.config.findUnique({ where: { key: registryKey } });
    if (registered) {
      const existing = await tx.researchStudy.findUnique({ where: { id: Number(registered.value) } });
      if (!existing || existing.projectId !== project.projectId)
        throw new Error('CDx study registry is inconsistent; existing data was preserved.');
      return { projectId: project.projectId, studyId: existing.id, created: 0 };
    }
    if (await tx.researchStudy.findFirst({ where: { projectId: project.projectId, title: cdxStudyTitle } }))
      throw new Error('An unregistered study already uses the CDx title; existing data was preserved.');
    const study = await tx.researchStudy.create({ data: {
      projectId: project.projectId, title: cdxStudyTitle, researchObject: cdxObject, goal: cdxGoal, status: 'in_review',
    } });
    const ids: Record<string, number> = {};
    for (const data of cdxTasks) {
      const { kind, ...content } = data;
      const input = researchTaskInput.parse({
        ...content, revision: 1, prompt: researchPrompt(kind, cdxObject, cdxGoal),
        inputMaterials: '本次四个独立子代理的只读研究及总控核验；完整原文见本任务来源台账。',
        status: 'submitted', asOf: cdxAsOf,
        notes: '来源经AI检索及核读；verified保留false，等待负责人逐条人工确认。未开展实际访谈。任务已提交，不代表人工审核完成。',
      });
      const row = await tx.researchTask.create({ data: {
        ...input, kind: data.kind, studyId: study.id, sources: json(input.sources), conclusions: json(input.conclusions),
        completedAt: new Date(),
      } });
      ids[data.kind] = row.id;
      await tx.researchTaskVersion.create({ data: { taskId: row.id, version: row.revision, snapshot: json(researchTaskView(row)) } });
    }
    const synthesis = await tx.researchSynthesis.create({ data: { ...cdxSynthesis(ids), studyId: study.id, sourceTaskIds: Object.values(ids) } });
    await tx.researchSynthesisVersion.create({ data: { synthesisId: synthesis.id, snapshot: json(synthesis) } });
    await tx.config.create({ data: { key: registryKey, value: String(study.id) } });
    return { projectId: project.projectId, studyId: study.id, created: 6 };
  }, { timeout: 15000 });
}
