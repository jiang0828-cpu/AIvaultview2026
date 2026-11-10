import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from 'file:///C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const dir=path.resolve('output/mrna-research');
const data=JSON.parse(await fs.readFile(path.join(dir,'research-data.json'),'utf8'));
const book=Workbook.create();
const col=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
const val=v=>v==null?'未披露':typeof v==='object'?JSON.stringify(v):v;
const list=v=>Array.isArray(v)?v.map(val).join('；'):val(v);
const table=(name,title,headers,rows,widths=[])=>{
  const s=book.worksheets.add(name), end=col(headers.length), bottom=rows.length+3;
  s.showGridLines=false;
  s.getRange('A1').values=[[title]];
  s.getRange('A1').format.font={bold:true,size:15,color:'#18353E'};
  s.getRange('A1').format.rowHeight=30;
  s.getRange(`A3:${end}3`).values=[headers];
  s.getRange(`A3:${end}3`).format={fill:'#24484E',font:{bold:true,color:'#FFFFFF',size:11},wrapText:true,rowHeight:36,verticalAlignment:'center',horizontalAlignment:'center'};
  if(rows.length){
    s.getRange(`A4:${end}${bottom}`).values=rows.map(r=>r.map(val));
    s.getRange(`A4:${end}${bottom}`).format={font:{name:'Microsoft YaHei',size:11,color:'#25383B'},verticalAlignment:'top',wrapText:true,rowHeight:94};
    s.tables.add(`A3:${end}${bottom}`,true,`${name.replace(/[^a-zA-Z]/g,'')}Table`);
  }
  for(let i=1;i<=headers.length;i++)s.getRange(`${col(i)}:${col(i)}`).format.columnWidth=widths[i-1]||26;
  if(rows.length)s.getRange(`A4:${end}${bottom}`).format.autofitRows();
  s.freezePanes.freezeRows(3);
  return s;
};
const drugMap=new Map();for(const t of data.trials.filter(t=>t.id!=='NCT04813627')){if(!drugMap.has(t.program))drugMap.set(t.program,{...t,ids:[],statuses:new Set(),sources:[]});const p=drugMap.get(t.program);p.ids.push(t.id);p.statuses.add(t.status);p.sources.push(...t.sourceIds);}
const drugs=[...drugMap.values()];
const summary=book.worksheets.add('Summary');summary.showGridLines=false;
summary.getRange('A1').values=[['mRNA肿瘤药物｜研究主台账 v2']];
summary.getRange('A1').format.font={bold:true,size:18,color:'#234A50'};
summary.getRange('A1').format.rowHeight=36;
summary.getRange('A3:B8').values=[['信息截止','2026-11-10'],['归一项目（本次覆盖）',null],['注册记录（含相邻/排除）',null],['分析更新数',null],['来源记录数',null],['关键边界','范围检索，非全球普查']];
summary.getRange('A10:B14').values=[['判断','当前口径'],['V940 III期','ITT RFS HR0.58[0.45,0.75]；不以mITT替代'],['BNT122 CRC','提前终止；OS数值不平衡未公开效应量'],['BNT113','PFS未达；OS继续，不能说全试验失败'],['中国早期数据','免疫反应/ORR与生存获益分开']];
summary.getRange('A:A').format.columnWidth=33;summary.getRange('B:B').format.columnWidth=80;
summary.getRange('A3:B14').format={font:{name:'Microsoft YaHei',size:11},wrapText:true,rowHeight:36,verticalAlignment:'center'};
summary.getRange('A10:B10').format.fill='#E4EFF0';
table('Programs','归一药物/项目；多试验不重复算新药',['项目','企业/历史合作','载荷路线','递送方式','注册编号','状态集合（逐研究）','边界与限制','来源ID'],drugs.map(p=>[p.program,p.company,p.route,p.delivery,p.ids.join('; '),[...p.statuses].join('; '),p.notes,p.sources.join('; ')]),[24,32,28,30,42,32,70,38]);
table('Trials','逐试验注册快照；入组数不是疗效分析分母',['NCT','项目','申办方','路线','适应证','阶段','注册状态','预计入组','实际入组','注册更新日','主要完成日','国家','范围','排除/相邻原因','口径与冲突','注册URL'],data.trials.map(t=>[t.id,t.program,t.sponsor,t.route,t.indication,t.phase,t.status,t.plannedEnrollment,t.actualEnrollment,t.registryUpdatedAt,t.primaryCompletion,t.countries.join('; '),t.scope,t.exclusionReason,t.notes,t.registryUrl]),[18,22,28,27,44,12,22,15,15,18,18,32,22,45,75,55]);
table('Evidence','临床队列与分析更新；结果不得跨试验排名',['分析ID','项目','试验','设计','人群/场景','方案','对照','结果分析n','分析集','主要终点','结果','安全性','数据截止','随访','局限/判断','来源ID'],data.evidence.map(e=>[e.id,e.program,e.trial,e.design,e.population||e.setting,e.regimen||e.treatment,e.control,e.n,e.analysisSet,e.endpoint,e.result,e.safety,e.dataCutoff,e.followUp,list(e.limitations)+'；'+e.interpretation,e.sourceIds.join('; ')]),[20,22,20,50,50,45,35,18,40,40,85,70,20,32,90,32]);
table('Endpoints','数值终点与分析集；缺失保留未披露',['分析ID','项目','试验','终点','指标','值','95%CI下界','95%CI上界','单位','治疗臂','对照','分析集','n','备注','来源ID'],data.evidence.flatMap(e=>(Array.isArray(e.endpoints)?e.endpoints:[]).map(x=>[e.id,e.program,e.trial,x.name,x.measure,x.value,x.ci?.[0],x.ci?.[1],x.unit,x.arm,x.comparator,x.analysisSet,x.n,x.notes,e.sourceIds.join('; ')])),[20,20,20,32,24,15,18,18,18,32,32,30,14,80,32]);
table('Sources','实际访问状态与可定位来源',['来源ID','类型','标题','发布方','来源日期','核验日期','URL','定位','访问范围/限制'],data.sources.map(s=>[s.id,s.kind,s.title,s.publisher,s.date,s.accessedDate||data.asOf,s.url,s.locator,s.accessLevel]),[24,24,65,30,19,19,80,65,65]);
table('BD','BD机会为待验证分析，不是采购承诺',['ID','目标项目','需求','合作切口','证据','待验证/反证','下一步','来源ID'],data.bd.map(b=>[b.id,b.target||b.title,b.need,b.entry||b.opportunity,b.evidence,b.validation||b.toVerify,b.next||b.nextAction,(b.sourceIds||[]).join('; ')]),[18,33,55,60,60,65,65,32]);
table('Technology','技术与CMC；标注临床前与分析推断',['主题','技术/事实','业务含义与边界','来源ID'],data.technology.map(t=>[t.title,list(t.detail),list(t.implication),(t.sourceIds||[]).join('; ')]),[36,110,110,40]);
table('Gaps','信息缺口与更新任务',['ID','主题/限制','优先级','状态','缺失数据','下一步','来源ID'],[...data.gaps,...data.limitations].map((g,i)=>typeof g==='object'?[g.id||'G'+(i+1),g.topic||g.title,g.priority,g.status,list(g.missing),g.nextAction,list(g.sourceIds)]:['L'+(i+1),g,'待更新','研究限制','不适用','后续获取原始数据；不作未知项的推算','不适用']),[15,65,15,65,75,85,35]);
table('Review','最可能误导决策的五项问题与修订',['问题','修订','依据'],data.reviewFixes.map(r=>[r.issue,r.revision,r.basis]),[60,100,100]);
table('Search','检索日志；API返回快照',['检索词/编号','日期','状态','返回记录数','是否后页'],data.searches.map(s=>[s.term||s.query||s.id,s.fetched||data.asOf,s.status,s.count,s.nextPage]),[85,28,18,18,18]);
book.worksheets.getItem('Search').getRange(`B4:B${data.searches.length+3}`).setNumberFormat('yyyy-mm-dd hh:mm');
book.worksheets.getItem('Sources').getRange(`E4:F${data.sources.length+3}`).setNumberFormat('yyyy-mm-dd');
book.worksheets.getItem('Trials').getRange(`J4:K${data.trials.length+3}`).setNumberFormat('yyyy-mm-dd');
summary.getRange('B4').formulas=[['=COUNTA(Programs!A4:A'+(drugs.length+3)+')']];
summary.getRange('B5').formulas=[['=COUNTA(Trials!A4:A'+(data.trials.length+3)+')']];
summary.getRange('B6').formulas=[['=COUNTA(Evidence!A4:A'+(data.evidence.length+3)+')']];
summary.getRange('B7').formulas=[['=COUNTA(Sources!A4:A'+(data.sources.length+3)+')']];
const blob=await SpreadsheetFile.exportXlsx(book);await blob.save(path.join(dir,'02_mRNA肿瘤药物主台账.xlsx'));
for(const s of book.worksheets.items){
  const preview=await book.render({sheetName:s.name,range:s.name==='Summary'?'A1:B14':'A1:D7',scale:1.3,format:'png'});
  await fs.writeFile(path.join(dir,`preview-${s.name}.png`),new Uint8Array(await preview.arrayBuffer()));
}
await fs.copyFile(path.join(dir,'02_mRNA肿瘤药物主台账.xlsx'),path.resolve('backend/media/projects/mrna/02_mRNA肿瘤药物主台账.xlsx'));
console.log(JSON.stringify({sheets:book.worksheets.items.map(s=>s.name),programs:drugs.length,trials:data.trials.length,evidence:data.evidence.length}));
