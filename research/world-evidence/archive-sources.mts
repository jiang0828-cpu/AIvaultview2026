import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { worldReport } from '../../backend/prisma/world-data.ts';
import { worldReport002 } from '../../backend/prisma/world-002-data.ts';

const destination = new URL('../raw/world-evidence/', import.meta.url);
mkdirSync(destination, { recursive: true });
const selected = ['HH26', 'GDP26', 'PROFIT26', '10Q', 'HOUSELETTER', 'BISRULE', 'LETTER', 'COUNSEL', 'PRICECHECK'];
const sources = [...worldReport.sources, ...worldReport002.sources].filter((source) => selected.includes(source.id));
const manifest: { id: string; url: string; retrievedAt: string; status?: number; sha256?: string; bytes?: number; error?: string }[] = [];
for (const source of sources) {
  const record: (typeof manifest)[number] = { id: source.id, url: source.url, retrievedAt: new Date().toISOString() };
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'VaultFolio research archive' } });
    record.status = response.status;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    const extension = response.headers.get('content-type')?.includes('pdf') ? 'pdf' : 'html';
    writeFileSync(new URL(`${source.id}.${extension}`, destination), body);
    record.bytes = body.length;
    record.sha256 = createHash('sha256').update(body).digest('hex');
  } catch (error) { record.error = error instanceof Error ? error.message : String(error); }
  manifest.push(record);
  writeFileSync(new URL('./source-manifest.json', import.meta.url), JSON.stringify(manifest, null, 2));
  console.log(`${source.id}: ${record.error ?? `archived ${record.bytes} bytes`}`);
}
