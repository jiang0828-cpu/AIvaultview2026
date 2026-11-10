import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data=JSON.parse(readFileSync(new URL('../../backend/media/projects/mrna/research-data.json',import.meta.url),'utf8'));

test('research references resolve uniquely and downloads use the authenticated media route',()=>{
  const ids=new Set(data.sources.map((s:{id:string})=>s.id));
  assert.equal(ids.size,data.sources.length);
  assert.equal(new Set(data.trials.map((t:{id:string})=>t.id)).size,data.trials.length);
  for(const item of [...data.evidence,...data.technology,...data.bd,...data.timeline]){
    assert.ok(item.sourceIds.length>0);
    for(const id of item.sourceIds)assert.ok(ids.has(id),`Missing source ${id}`);
  }
  for(const item of data.deliverables)assert.match(item.url,/^\/media\/projects\/mrna\//);
  for(const item of data.timeline)assert.ok(item.title&&item.detail);
});

test('V940 primary ITT, sensitivity analysis and registry planning totals remain separate',()=>{
  const itt=data.evidence.find((e:{id:string})=>e.id==='E-V940-III-ITT');
  const sensitivity=data.evidence.find((e:{id:string})=>e.id==='E-V940-III-SENS');
  assert.equal(itt.nRaw.randomized,1137);
  assert.equal(itt.endpoints.find((e:{name:string})=>e.name==='RFS').value,0.58);
  assert.ok(sensitivity);
  const registration=data.trials.find((t:{id:string})=>t.id==='NCT05933577');
  assert.equal(registration.plannedEnrollment,1089);
  assert.equal(registration.actualEnrollment,null);
  assert.match(registration.notes,/冲突/);
  for(const row of data.chart.rfs)assert.ok(row.low<row.hr&&row.hr<row.high);
});

test('negative evidence and non-treatment boundaries cannot silently disappear',()=>{
  const crc=data.evidence.find((e:{id:string})=>e.id==='E-BNT122-CRC-STOP');
  const hpv=data.evidence.find((e:{id:string})=>e.id==='E-BNT113-PFS-NEG');
  assert.equal(crc.sentiment,'negative');
  assert.match(JSON.stringify(crc),/OS/);
  assert.equal(hpv.sentiment,'negative');
  assert.match(hpv.interpretation,/OS/);
  for(const id of ['NCT04813627','NCT07702656'])assert.equal(data.trials.find((t:{id:string})=>t.id===id).scope,'相邻排除');
  assert.equal(data.evidence.find((e:{id:string})=>e.id==='E-ITI5000-2026').endpoints.length,0);
});

test('early immune response denominators are distinct from registered enrollment',()=>{
  const evm=data.evidence.find((e:{id:string})=>e.id==='E-EVM16-2026');
  assert.match(evm.n,/9/);
  assert.match(evm.interpretation,/免疫|ORR/);
  assert.equal(data.trials.find((t:{id:string})=>t.id==='NCT06541639').plannedEnrollment,78);
  const later=data.evidence.filter((e:{trial:string})=>e.trial==='NCT04161755');
  assert.equal(later.length,2);
  assert.match(later.map((e:{interpretation:string})=>e.interpretation).join(' '),/同一|延长|非随机/);
});
