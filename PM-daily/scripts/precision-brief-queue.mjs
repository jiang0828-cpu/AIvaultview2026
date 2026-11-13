import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../backend/src/config.ts';
import { queuePrecisionBriefRun, claimPrecisionBriefRun, failPrecisionBriefRun } from '../../backend/src/precisionBrief.ts';
import { precisionBriefProjectMarker } from '../../backend/src/precisionBriefSchema.ts';
import { readResearchSources, withResearchPlan } from './research-plan.mjs';
export { withResearchPlan } from './research-plan.mjs';

export function dailyWindow(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 3600000);
  let cutoff = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 1);
  if (cutoff > now.getTime()) cutoff -= 86400000;
  const end = new Date(cutoff);
  return { issueDate: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(end),
    windowStart: new Date(cutoff - 86400000), windowEnd: end, firstIssue: false };
}

const metadata = row => ({ runId: row.id, projectId: row.projectId, runKey: row.runKey, issueDate: row.issueDate,
  windowStart: new Date(row.windowStart).toISOString(), windowEnd: new Date(row.windowEnd).toISOString(), firstIssue: row.firstIssue, status: row.status });

export async function runQueue(args = process.argv.slice(2)) {
  const mode = args[0] ?? '--next';
  if (mode === '--help') { console.log('Usage: npm run precision:queue -- [--next|--create|--start <runId>|--fail <runId> <reason>]'); return 0; }
  const db = new PrismaClient();
  try {
    const projects = await db.content.findMany({ where: { description: { contains: precisionBriefProjectMarker }, scene: 'work', type: 'folder', isProject: true } });
    if (projects.length !== 1) throw new Error('日报项目不存在或标记不唯一；请先运行定向seed');
    const projectId = projects[0].id;
    if (mode === '--next') {
      const run = await db.precisionBriefRun.findFirst({ where: { projectId, status: 'queued' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      console.log(JSON.stringify(run ? withResearchPlan(metadata(run), await readResearchSources()) : { runId: null, projectId, status: 'empty' }));
      return 0;
    }
    if (mode === '--create') {
      const config = await readResearchSources();
      const window = dailyWindow();
      // Validate the plan before mutating the queue.
      withResearchPlan({ runKey: 'preflight', windowStart: window.windowStart.toISOString(), windowEnd: window.windowEnd.toISOString() }, config);
      console.log(JSON.stringify(withResearchPlan(metadata(await queuePrecisionBriefRun(db, projectId, window)), config)));
      return 0;
    }
    if (!['--start', '--claim', '--fail'].includes(mode)) throw new Error('未知队列操作');
    const runId = Number(args[1]);
    if (!Number.isInteger(runId) || runId <= 0) throw new Error('运行ID须为正整数');
    const run = await db.precisionBriefRun.findFirst({ where: { id: runId, projectId } });
    if (!run) throw new Error('运行不存在或不属于日报项目');
    if (mode === '--fail') {
      if (!['queued', 'running'].includes(run.status)) throw new Error('只能将排队或运行中的任务标为失败');
      const reason = args.slice(2).join(' ').trim();
      if (!reason) throw new Error('必须提供失败原因');
      const failed = await failPrecisionBriefRun(db, projectId, metadata(run), [reason.slice(0, 2000)]);
      console.log(JSON.stringify(failed ? metadata(failed) : { runId, status: 'failed' }));
      return 0;
    }
    const config = await readResearchSources();
    withResearchPlan(metadata(run), config);
    console.log(JSON.stringify(withResearchPlan(metadata(await claimPrecisionBriefRun(db, runId)), config)));
    return 0;
  } catch (error) { console.error(`precision-brief: ${error.message}`); return 2; }
  finally { await db.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runQueue();
