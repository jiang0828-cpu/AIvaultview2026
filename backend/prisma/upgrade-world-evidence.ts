import { readFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { worldProjectMarker, worldIssueMarker } from '../src/worldSchema.js';
import { worldIssue, worldDataDocument, worldChapters } from './world.js';
import { worldIssue002, worldDataDocument002, worldChapters002 } from './world-002.js';

type BaselineDocument = { title: string; type: string; scene: string; description: string };
const baselines = ['baseline-v1.json', 'baseline-evidence-v2.json', 'baseline-evidence-v3.json', 'baseline-evidence-v4.json'].map((file) =>
  JSON.parse(readFileSync(new URL(`../../research/world-evidence/${file}`, import.meta.url), 'utf8')) as {
    rows: { number: string; documents: BaselineDocument[] }[];
  });
type Change = { id: number; title: string; before: string; after: string };

export async function upgradeWorldEvidence(db: PrismaClient, apply = false, beforeApply?: (changes: readonly Change[]) => void) {
  return db.$transaction(async (tx) => {
    const candidates = await tx.content.findMany({ where: { type: 'folder', scene: 'system' } });
    const projects = candidates.filter((item) => item.description.includes(worldProjectMarker));
    if (projects.length !== 1) throw new Error('Expected exactly one system WORLD_PROJECT; nothing changed.');
    const project = projects[0];
    const changes: Change[] = [];
    const conflicts: { id: number; title: string; reason: string }[] = [];
    for (const [index, desired] of [[worldIssue, worldDataDocument, ...worldChapters],
      [worldIssue002, worldDataDocument002, ...worldChapters002]].entries()) {
      const folders = await tx.content.findMany({ where: { parentId: project.id, title: desired[0].title, type: 'folder', scene: 'system' } });
      if (folders.length !== 1 || !folders[0].description.includes(worldIssueMarker)) throw new Error(`Ambiguous or missing issue ${index + 1}; run seed first.`);
      const folder = folders[0];
      const nodes = [folder, ...await tx.content.findMany({ where: { parentId: folder.id } })];
      for (const document of desired) {
        const matching = nodes.filter((node) => node.title === document.title);
        if (matching.length !== 1) throw new Error(`Ambiguous or missing content: ${document.title}`);
        const node = matching[0];
        if (node.type !== document.type || node.scene !== 'system') throw new Error(`Content ownership conflict: ${document.title}`);
        if (node.description === document.description) continue;
        const original = baselines.some((baseline) => baseline.rows[index].documents.some((item) => item.title === node.title && node.description === item.description));
        if (!original) {
          conflicts.push({ id: node.id, title: node.title, reason: 'Description differs from both recorded original and reviewed revision; preserved.' });
          continue;
        }
        changes.push({ id: node.id, title: node.title, before: node.description, after: document.description });
      }
    }
    if (apply) {
      if (changes.length) beforeApply?.(changes);
      for (const change of changes) await tx.content.update({ where: { id: change.id }, data: { description: change.after } });
      if (changes.length) await tx.content.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
    }
    return { projectId: project.id, applied: apply, changes, conflicts };
  });
}
