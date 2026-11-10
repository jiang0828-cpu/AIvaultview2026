import { createHash } from 'node:crypto';

type SeedFields={title:string;type:string;scene:string;topics?:unknown;description?:string;sortOrder:number;parentId?:number|null};
export const descriptionHash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function seedFingerprint(n:SeedFields){
  return descriptionHash(JSON.stringify([n.title,n.type,n.scene,n.topics??null,n.description??'',n.sortOrder,n.parentId??null]));
}
export function mayRefreshSeed(existing:SeedFields|undefined,expected:SeedFields,baseline?:string,oldDescriptionHash?:string,legacy?:SeedFields){
  if(!existing)return true;
  if(baseline)return seedFingerprint(existing)===baseline;
  if(seedFingerprint(existing)===seedFingerprint(expected))return true;
  if(legacy&&seedFingerprint(existing)===seedFingerprint(legacy))return true;
  // Upgrade a description-only baseline only when every other owned field still matches.
  return Boolean(oldDescriptionHash&&descriptionHash(existing.description||'')===oldDescriptionHash&&seedFingerprint({...existing,description:''})===seedFingerprint({...expected,description:''}));
}
