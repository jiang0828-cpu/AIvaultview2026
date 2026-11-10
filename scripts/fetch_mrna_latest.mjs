import fs from 'node:fs/promises';
const file='research/mrna-v2/registry-extra.json';
const data=JSON.parse(await fs.readFile(file,'utf8'));
for(const id of ['NCT05533697','NCT07652242']){
  const response=await fetch(`https://clinicaltrials.gov/api/v2/studies/${id}`,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`${id}: ${response.status}`);
  const {protocolSection:p,hasResults}=await response.json();
  const study={id:p.identificationModule.nctId,title:p.identificationModule.briefTitle,sponsor:p.sponsorCollaboratorsModule?.leadSponsor?.name,status:p.statusModule.overallStatus,whyStopped:p.statusModule.whyStopped||'',updated:p.statusModule.lastUpdatePostDateStruct?.date,start:p.statusModule.startDateStruct,primaryCompletion:p.statusModule.primaryCompletionDateStruct,completion:p.statusModule.completionDateStruct,phase:p.designModule?.phases,enrollment:p.designModule?.enrollmentInfo,design:p.designModule?.designInfo,conditions:p.conditionsModule?.conditions,interventions:p.armsInterventionsModule?.interventions,arms:p.armsInterventionsModule?.armGroups,primaryOutcomes:p.outcomesModule?.primaryOutcomes,hasResults:Boolean(hasResults),countries:[...new Set(p.contactsLocationsModule?.locations?.map(x=>x.country)||[])],url:`https://clinicaltrials.gov/study/${id}`};
  data.studies=data.studies.filter(s=>s.id!==id);data.studies.push(study);
  data.searches=data.searches.filter(s=>s.term!==id);data.searches.push({term:id,fetched:new Date().toISOString(),count:1,nextPage:false,status:'ok'});
}
await fs.writeFile(file,JSON.stringify(data,null,2));
console.log(`Additional registry records: ${data.studies.length}`);
