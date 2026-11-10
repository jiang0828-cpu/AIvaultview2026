import fs from 'node:fs/promises';
import path from 'node:path';
const target = path.resolve('research/mrna-v2/registry.json');
const terms = ['V940 OR mRNA-4157 OR intismeran', 'BNT111 OR BNT112 OR BNT113 OR BNT114 OR BNT115 OR BNT116 OR BNT122 OR RO7198457', 'CVGBM OR CV9104 OR mRNA-2752 OR mRNA-2416 OR SAR441000 OR mRNA-5671', 'LK101 OR WGc-043 OR EVM16 OR EVM14 OR JCXH211 OR SYS6026 OR LY01620 OR BNT141 OR BNT142 OR BNT151'];
const byId = new Map(); const searches = [];
for (const term of terms) {
  try {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies');
    url.searchParams.set('query.term', term); url.searchParams.set('pageSize', '100'); url.searchParams.set('format', 'json');
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    for (const study of body.studies || []) byId.set(study.protocolSection.identificationModule.nctId, study);
    searches.push({ term, fetched: new Date().toISOString(), count: body.studies?.length, nextPage: Boolean(body.nextPageToken), status: 'ok' });
  } catch (error) { searches.push({ term, status: 'failed', error: String(error) }); }
}
const studies = [...byId.values()].map(({ protocolSection: p, hasResults }) => ({
  id: p.identificationModule.nctId, title: p.identificationModule.briefTitle,
  sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
  status: p.statusModule.overallStatus, whyStopped: p.statusModule.whyStopped || '',
  updated: p.statusModule.lastUpdatePostDateStruct?.date,
  start: p.statusModule.startDateStruct, primaryCompletion: p.statusModule.primaryCompletionDateStruct,
  completion: p.statusModule.completionDateStruct,
  phase: p.designModule?.phases, enrollment: p.designModule?.enrollmentInfo,
  design: p.designModule?.designInfo, conditions: p.conditionsModule?.conditions,
  interventions: p.armsInterventionsModule?.interventions,
  arms: p.armsInterventionsModule?.armGroups,
  primaryOutcomes: p.outcomesModule?.primaryOutcomes,
  hasResults: Boolean(hasResults), countries: [...new Set(p.contactsLocationsModule?.locations?.map(x => x.country) || [])],
  url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`,
}));
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, JSON.stringify({ asOf: '2026-11-10', searches, studies }, null, 2));
console.log(JSON.stringify({ searches, uniqueStudies: studies.length, file: target }));
