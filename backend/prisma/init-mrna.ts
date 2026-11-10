import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { legacyMrnaProject, caseProjects, type CaseNode } from './cases.js';
import { seedFingerprint, mayRefreshSeed } from './mrna-ownership.js';

const db=new PrismaClient();
try {
  const project=await db.content.findFirst({where:{title:legacyMrnaProject.title,type:'folder'}});
  if(!project)throw new Error('mRNA project not found; run the normal initial seed on a new database first.');
  const previous=new Map<string,CaseNode>();
  const walk=(nodes:CaseNode[])=>{for(const n of nodes){previous.set(n.title,n);walk(n.children||[]);}};
  walk(legacyMrnaProject.children||[]);
  const descendants=await db.content.findMany();
  const byId=new Map(descendants.map(n=>[n.id,n]));
  const belongs=(id:number|null):boolean=>id===project.id||Boolean(id&&byId.get(id)&&belongs(byId.get(id)!.parentId));
  const historical=descendants.filter(n=>belongs(n.parentId));
  let archived=0,updated=0,preserved=0;
  for(const n of historical){
    const old=previous.get(n.title);
    if(old&&seedFingerprint(n)===seedFingerprint({...old,parentId:n.parentId})){
      await db.content.update({where:{id:n.id},data:{description:`> 历史版本（已被2026-11-10研究更新替代）。请返回mRNA项目查看最新研究工作台与交付物；下文仅供追溯，不能作为当前状态。\n\n${n.description}`}});archived++;
    }
  }
  const current=caseProjects.find(p=>p.title===project.title)!;
  const baselineRecord=await db.config.findUnique({where:{key:'mrna_v3_seed_hashes'}});
  const baselines:Record<string,string>=baselineRecord?JSON.parse(baselineRecord.value):{};
  const oldBaselineRecord=await db.config.findUnique({where:{key:'mrna_v2_seed_hashes'}});
  const oldBaselines:Record<string,string>=oldBaselineRecord?JSON.parse(oldBaselineRecord.value):{};
  for(const n of current.children||[]){
    const existing=historical.find(x=>x.parentId===project.id&&x.title===n.title);
    const old=previous.get(n.title);
    const data={title:n.title,type:n.type,scene:n.scene,topics:n.topics,description:n.description||'',sortOrder:n.sortOrder,parentId:project.id};
    const safe=mayRefreshSeed(existing,data,baselines[n.title],oldBaselines[n.title],old?{...old,parentId:project.id}:undefined);
    if(!safe){preserved++;continue;}
    if(existing)await db.content.update({where:{id:existing.id},data});else await db.content.create({data});
    baselines[n.title]=seedFingerprint(data);
    updated++;
  }
  // A custom project description remains untouched.
  if(project.description===(legacyMrnaProject.description||''))await db.content.update({where:{id:project.id},data:{description:current.description}});
  await db.config.upsert({where:{key:'mrna_v3_seed_hashes'},create:{key:'mrna_v3_seed_hashes',value:JSON.stringify(baselines)},update:{value:JSON.stringify(baselines)}});
  console.log(JSON.stringify({projectId:project.id,updated,archived,preservedCustomDocuments:preserved}));
} finally {await db.$disconnect();}
