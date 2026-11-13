import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePrecisionBriefForPublish } from '../../backend/src/precisionBriefSchema.ts';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceDirectory = resolve(projectDirectory, '..');
const activeFile = resolve(projectDirectory, 'runtime/active.json');
const stdin = async () => { let value = ''; for await (const chunk of process.stdin) value += chunk; return value; };

export async function validateFile(path) {
  const input = JSON.parse(await readFile(resolve(path), 'utf8'));
  return { input, ...validatePrecisionBriefForPublish(input) };
}

export async function runValidation(args = process.argv.slice(2), options = {}) {
  const mode = args[0];
  if (mode === '--help') { console.log('Usage: npm run precision:validate -- <brief.json>'); return 0; }
  const hook = mode === '--hook' || mode === '--stop';
  let candidate = mode;
  try {
    if (hook) {
      // Only the current brief run opts into hooks; unrelated repo work stays unaffected.
      const raw = options.eventInput ?? await stdin();
      let event = {};
      try { if (raw.trim()) event = JSON.parse(raw); } catch { return 0; }
      if (event.stop_hook_active === true) return 0;
      let active;
      try { active = JSON.parse(await readFile(options.activeFilePath ?? activeFile, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
      if (active.status !== 'awaiting_validation') return 0;
      candidate = resolve(workspaceDirectory, active.inputPath);
      if (!candidate.startsWith(projectDirectory + '/') && !candidate.startsWith(projectDirectory + '\\')) throw new Error('Active brief path must stay inside PM-daily');
    }
    if (!candidate) { console.error('Usage: node --import tsx scripts/validate-precision-brief.mjs <brief.json>'); return 2; }
    const result = await validateFile(candidate);
    if (!result.success) { console.error(result.errors.map(message => `precision-brief: ${message}`).join('\n')); return 2; }
    if (!hook) console.log(`precision-brief: valid (${result.data.items.length} items, ${result.data.sources.length} sources)`);
    return 0;
  } catch (error) {
    console.error(`precision-brief: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runValidation();
