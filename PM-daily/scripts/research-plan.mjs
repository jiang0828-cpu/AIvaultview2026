import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceConfigPath = fileURLToPath(new URL('../sources.json', import.meta.url));
const governmentIds = ['nanjing-amr', 'nanjing-government', 'jiangbei-government'];
const companyIds = ['shengene', 'shengene-news', 'shengene-profile', ...governmentIds];
const otherSections = [
  ['competitors', '同行与竞对', ['natera', 'guardant', 'grail', 'bgi', 'burning-rock', 'geneplus'], ['NGS', 'MRD', '液体活检', '产品', '财报', '融资']],
  ['regulation', '监管与支付', ['fda-ivd', 'nmpa', 'cde', 'nhsa', 'mohrss'], ['伴随诊断', 'MRD', 'IVD', '审批', '医保', '支付']],
  ['science', '科学与突破', ['clinicaltrials', 'pubmed', 'nature-cancer', 'nejm'], ['ctDNA', 'MRD', '肿瘤基因组', '多组学', 'AI', '早筛']],
  ['partners', '上下游伙伴', ['illumina', 'pacbio', 'mgi', 'roche'], ['测序', '试剂', '肿瘤', '临床', '研发']],
];

function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function httpUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function strings(value, field) {
  if (!Array.isArray(value) || !value.length || value.some(entry => !nonempty(entry)) || new Set(value).size !== value.length) {
    throw new Error(`sources.json: ${field} must be a nonempty array of unique strings`);
  }
  return [...value];
}
function isoInstant(value) {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  return Boolean(match && Number.isFinite(Date.parse(value)) && validDay(match[1])
    && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60);
}
function validDay(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateRunMetadata(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run) || !nonempty(run.runKey)
    || !/^[A-Za-z0-9_.:-]{1,120}$/.test(run.runKey)) throw new Error('run metadata: valid runKey is required');
  if (!isoInstant(run.windowStart) || !isoInstant(run.windowEnd) || Date.parse(run.windowStart) >= Date.parse(run.windowEnd)) {
    throw new Error('run metadata: ISO windowStart must precede ISO windowEnd');
  }
}

function validateSources(config) {
  if (!config || !Array.isArray(config.sources) || !config.sources.length) throw new Error('sources.json: sources array is required');
  const sources = new Map();
  for (const source of config.sources) {
    if (!source || !nonempty(source.id) || !/^[a-z0-9-]+$/.test(source.id) || !nonempty(source.name)
      || !nonempty(source.type) || !httpUrl(source.url) || sources.has(source.id)) {
      throw new Error('sources.json: invalid or duplicate source definition');
    }
    sources.set(source.id, { id: source.id, name: source.name, url: source.url, type: source.type });
  }
  const policy = config.researchPolicy;
  if (!policy || typeof policy !== 'object') throw new Error('sources.json: researchPolicy is required');
  const aliases = strings(policy.companyAliases, 'companyAliases');
  const requiredIds = strings(policy.companyRequiredSourceIds, 'companyRequiredSourceIds');
  const terms = strings(policy.companyEventTerms, 'companyEventTerms');
  if (requiredIds.some(id => !/^[a-z0-9-]{1,80}$/.test(id))) throw new Error('sources.json: invalid companyRequiredSourceIds');
  if (['公示', '拟授奖', '市长质量奖', '提名奖', '质量', '专利', '注册', 'IPO'].some(term => !terms.includes(term))) {
    throw new Error('sources.json: companyEventTerms is missing required award/publicity or business terms');
  }
  if (companyIds.some(id => !requiredIds.includes(id))) throw new Error('sources.json: companyRequiredSourceIds must include official company and government entry IDs');
  if (!Array.isArray(policy.entityEvidence) || !policy.entityEvidence.length) throw new Error('sources.json: entityEvidence is required');
  const evidence = policy.entityEvidence.map(entry => {
    if (!entry || !nonempty(entry.name) || !nonempty(entry.relationship) || !httpUrl(entry.url)
      || !(nonempty(entry.verifiedAt) && (validDay(entry.verifiedAt) || isoInstant(entry.verifiedAt)))) {
      throw new Error('sources.json: invalid entityEvidence definition');
    }
    return { name: entry.name, relationship: entry.relationship, url: entry.url, verifiedAt: entry.verifiedAt };
  });
  if (aliases.some(alias => !evidence.some(entry => entry.name === alias))) throw new Error('sources.json: every company alias requires entityEvidence');
  const select = ids => ids.map(id => {
    if (!sources.has(id)) throw new Error('sources.json: unresolved source ID in required sources or section mappings');
    return { ...sources.get(id) };
  });
  select([...requiredIds, ...otherSections.flatMap(section => section[2])]);
  return { aliases, terms, evidence, requiredIds, select };
}

function check(id, method, sources, queries, instructions) {
  return { id, method, sources, queries, instructions, status: 'not_started', checkedAt: null };
}
function task(kind, label, requiredChecks) {
  return { kind, label, status: 'not_started', requiredChecks, coverage: {
    status: 'not_started', checkedAt: null, completedCheckIds: [], unresolvedCandidates: [],
    ledger: requiredChecks.map(entry => ({ checkId: entry.id, status: 'not_started', checkedAt: null,
      visitedUrls: [], executedQueries: [], findings: [], failures: [] })),
    noNewsEligible: false,
    completionRule: 'Only actual completed checks with recorded URLs/queries, access times and results establish coverage. Homepage-only or parent-company-only checks are insufficient. no_news requires every required check completed, no unresolved candidates and no verified in-window additions. Any retrieval/verification failure stays failed; never convert it to no_news.',
    candidateFields: ['url', 'entity', 'publishedAt', 'generatedAt', 'publicityStart', 'publicityEnd', 'accessedAt', 'attachmentUrls', 'windowDecision', 'reason'],
  } };
}

export function createResearchPlan(run, config) {
  validateRunMetadata(run);
  const { aliases, terms, evidence, requiredIds, select } = validateSources(config);
  const queries = aliases.flatMap(alias => [`"${alias}"`, ...terms.map(term => `"${alias}" "${term}"`)]);
  const companySources = select(requiredIds.filter(id => !governmentIds.includes(id)));
  const governmentSources = select(governmentIds);
  const company = task('company', '世和动态', [
    check('source-index', 'direct_open', companySources, [], 'Directly open the official latest-news column, profile and homepage navigation; inspect dated entries and linked columns. A homepage visit alone does not complete this check.'),
    check('government-source-index', 'direct_open', governmentSources, [], 'Directly open Nanjing government, market-regulation and Jiangbei New Area latest notice lists; follow notice/publicity channels without relying on search-engine indexing.'),
    check('announcement-body', 'read_original_and_attachments', select(requiredIds), [], 'The supplied sources are discovery entry points, not inspected original evidence. After list inspection, read relevant original announcements and all embedded or separately linked attachments, including PDF/Word/Excel award/nomination lists. Check every verified entity name in both body and attachments even when absent from the title. Record negative inspection results and attachment access failures.'),
    check('entity-search', 'search_all_verified_aliases', select(requiredIds), queries, 'Execute all verified brand, parent and subsidiary aliases with award/publicity, quality, patent, registration and IPO terms. Search results are discovery leads; verify original body and attachments. Do not infer unverified partners.'),
  ]);
  return { version: 1, runKey: run.runKey, windowStart: run.windowStart, windowEnd: run.windowEnd,
    timezone: 'Asia/Shanghai', status: 'not_started', execution: 'manual_research_required',
    notice: 'This is a research plan and blank coverage ledger, not network collection, source evidence or a guarantee that no news was missed.',
    instructions: [
      'Keep the queued runId, runKey, issueDate and exact window; do not widen a retry window or substitute the current date.',
      'Inspect latest source lists first, then original announcement bodies and embedded or separate attachments; search summaries and list/homepage URLs are not event evidence.',
      'Record publication date, page/document generation date and publicity period separately; a later generation date or publicity end does not establish a new publication. Record original research date separately from company promotion date.',
      'Use Beijing time. Preserve date-only source values. If a day-only date straddles the 09:00 window boundary, retain an unresolved candidate for verification; never invent hours/minutes or claim it belongs inside the window.',
      'Fill each check and ledger from actual research with URLs, executed queries, access time, results and failures. The plan never marks coverage complete. no_news requires completed coverage and zero unresolved candidates; failures remain failed.',
      'Only source-confirmed entity relationships may be stated. Sources and entityEvidence configure research leads; re-open and verify original evidence before making event or relationship claims.',
    ], entityEvidence: evidence, companyAliases: aliases,
    tasks: [company, ...otherSections.map(([kind, label, ids, keywords]) => {
      const sources = select(ids);
      return task(kind, label, [
        check('source-index', 'direct_open', sources, [], 'Open the corresponding official latest announcements, registry or journal lists and inspect dated entries within the unchanged run window.'),
        check('announcement-body', 'read_original_and_attachments', sources, [], 'Read candidate original texts, papers, registry records and relevant attachments; verify publication dates, facts and limitations independently from summaries.'),
        check('topic-search', 'official_source_search', sources, sources.flatMap(source => keywords.map(term => `site:${new URL(source.url).hostname} "${term}"`)), 'Use topic searches to discover leads in the listed official sources; return to original texts and record unresolved dates or access failures.'),
      ]);
    })] };
}

export function withResearchPlan(metadata, config) {
  if (!metadata) return metadata;
  if (metadata.status === 'empty' || metadata.status === 'failed') {
    if (!Object.hasOwn(metadata, 'researchPlan')) return metadata;
    const output = { ...metadata };
    delete output.researchPlan;
    return output;
  }
  return { ...metadata, researchPlan: createResearchPlan(metadata, config) };
}

export async function readResearchSources(path = sourceConfigPath) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch { throw new Error('sources.json: cannot read source configuration'); }
  try { return JSON.parse(text); }
  catch { throw new Error('sources.json: invalid JSON'); }
}

export async function runPlan(args = process.argv.slice(2), io = console) {
  if (args.length === 1 && args[0] === '--help') {
    io.log('Usage: npm run precision:plan -- <run-metadata.json> [--sources <sources.json>]\nGenerates a plan only; does not execute network research.');
    return 0;
  }
  try {
    if (!args[0] || args[0].startsWith('--') || ![1, 3].includes(args.length) || (args.length === 3 && args[1] !== '--sources')) {
      throw new Error('expected <run-metadata.json> [--sources <sources.json>]; use --help');
    }
    let metadata;
    try { metadata = JSON.parse(await readFile(resolve(args[0]), 'utf8')); }
    catch { throw new Error('run metadata: cannot read valid JSON'); }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('run metadata: expected a JSON object');
    const metadataFields = new Set(['runId', 'projectId', 'runKey', 'issueDate', 'windowStart', 'windowEnd', 'firstIssue', 'status']);
    metadata = Object.fromEntries(Object.entries(metadata).filter(([key]) => metadataFields.has(key)));
    if (metadata.status === 'empty' && metadata.runId === null) {
      io.log(JSON.stringify(metadata));
      return 0;
    }
    validateRunMetadata(metadata);
    if (metadata.status === 'failed') {
      io.log(JSON.stringify(metadata));
      return 0;
    }
    const output = withResearchPlan(metadata, await readResearchSources(args[2] ? resolve(args[2]) : undefined));
    io.log(JSON.stringify(output));
    return 0;
  } catch (error) { io.error(`precision-plan: ${error.message}`); return 2; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runPlan();
