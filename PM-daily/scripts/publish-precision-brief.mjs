import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { PrismaClient } from '@prisma/client';
import '../../backend/src/config.ts';
import { publishPrecisionBrief } from '../../backend/src/precisionBrief.ts';
import { precisionBriefEditionPayload, precisionBriefProjectMarker } from '../../backend/src/precisionBriefSchema.ts';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(process.env.PM_BRIEF_OUTPUT_DIR || projectDirectory);

export const editionPayload = precisionBriefEditionPayload;

export async function publishFile(inputPath, requestedProjectId) {
  const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  const db = new PrismaClient();
  try {
    const matches = await db.content.findMany({ where: { description: { contains: precisionBriefProjectMarker }, isProject: true, scene: 'work' } });
    const project = requestedProjectId ? matches.find(item => item.id === requestedProjectId) : matches.length === 1 ? matches[0] : null;
    if (!project) throw new Error('日报项目不存在或标记不唯一；请先运行定向seed并传入正确项目ID');
    // The backend service validates and publishes atomically; failure records never replace current.
    const run = await publishPrecisionBrief(db, project.id, input);
    if (run.status !== 'published') throw new Error(run.errorMessage || '日报未通过发布校验');
    if (!run.isCurrent) throw new Error('此运行已是历史版本，未改写当前日报副本；请新建修订版本或使用管理员回退接口');
    if (!isDeepStrictEqual(editionPayload(input), editionPayload(run))) {
      throw new Error('此runKey已发布其他内容，未覆盖数据库或本地副本；修订日报请使用新的runKey');
    }
    try {
      await mkdir(resolve(outputDirectory, 'published'), { recursive: true });
      await mkdir(resolve(outputDirectory, 'runtime'), { recursive: true });
      const temporary = resolve(outputDirectory, `published/current.${process.pid}.tmp`);
      await writeFile(temporary, JSON.stringify({ ...input, projectId: project.id, publishedRunId: run.id }, null, 2));
      await rename(temporary, resolve(outputDirectory, 'published/current.json'));
      await writeFile(resolve(outputDirectory, 'runtime/active.json'), JSON.stringify({ status: 'published', runId: run.id, projectId: project.id, updatedAt: new Date().toISOString() }, null, 2));
    } catch (error) { console.error(`precision-brief: 数据库已发布，但本地文件副本未写完：${error.message}`); }
    return run;
  } finally { await db.$disconnect(); }
}

export async function runPublish(args = process.argv.slice(2)) {
  if (args[0] === '--help') { console.log('Usage: npm run precision:publish -- <brief.json> [projectId]'); return 0; }
  if (!args[0]) { console.error('Usage: node --import tsx scripts/publish-precision-brief.mjs <brief.json> [projectId]'); return 2; }
  try {
    await mkdir(resolve(outputDirectory, 'runtime'), { recursive: true });
    const projectId = args[1] === undefined ? undefined : Number(args[1]);
    if (projectId !== undefined && (!Number.isInteger(projectId) || projectId <= 0)) throw new Error('项目ID须为正整数');
    const run = await publishFile(args[0], projectId);
    console.log(JSON.stringify({ status: run.status, projectId: run.projectId, runId: run.id, issueDate: run.issueDate }));
    return 0;
  } catch (error) {
    console.error(`precision-brief: ${error.message}`);
    await mkdir(resolve(outputDirectory, 'runtime'), { recursive: true });
    await writeFile(resolve(outputDirectory, 'runtime/active.json'), JSON.stringify({ status: 'failed', errorMessage: error.message, updatedAt: new Date().toISOString() }, null, 2));
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runPublish();
