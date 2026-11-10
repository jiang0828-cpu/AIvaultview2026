import fs from 'node:fs/promises';
const file='research/mrna-v2/findings.json';
const data=JSON.parse(await fs.readFile(file,'utf8'));
const wg=data.evidence.find(e=>e.id==='E-WGC-2026');
wg.dataCutoff=null;
wg.observationDates={crOngoing:'2026-01-11',abstractUpdated:'2026-05-12'};
wg.correction='ASCO2026可用原始摘要更新；50%为2/4，非大型试验证据。CR状态观察日2026-01-11、摘要更新日2026-05-12均不是明确披露的全局临床数据截止日。';
await fs.writeFile(file,JSON.stringify(data,null,2));
