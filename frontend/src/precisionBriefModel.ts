import type { Content } from './types';
import { precisionBriefProjectMarker } from '../../backend/src/precisionBriefSchema';
import type { PrecisionBriefCurrentResponse, PrecisionBriefItemView, PrecisionBriefRunSummary, PrecisionBriefRunView, PrecisionBriefSourceView } from '../../backend/src/precisionBriefSchema';

export const precisionBriefMarker = precisionBriefProjectMarker;
export const precisionSections = [
  { key: 'company', title: '世和动态', short: '01', scope: '公司公告、论文、合作与产品进展' },
  { key: 'competitors', title: '同行与竞对', short: '02', scope: '产品、财报、融资与商业化动态' },
  { key: 'regulation', title: '监管与支付', short: '03', scope: 'FDA、NMPA、伴随诊断、支付与准入' },
  { key: 'science', title: '科学与突破', short: '04', scope: 'ctDNA、MRD、肿瘤基因组与多组学' },
  { key: 'partners', title: '上下游伙伴', short: '05', scope: '测序企业、药物研发与临床诊疗' },
] as const;
export type PrecisionSection = typeof precisionSections[number]['key'];
export type BriefSource = PrecisionBriefSourceView;
export type BriefItem = PrecisionBriefItemView;
export type BriefRun = PrecisionBriefRunView;
export type BriefRunSummary = PrecisionBriefRunSummary;
export type BriefCurrent = PrecisionBriefCurrentResponse;

export function isBriefScheduleOverdue(lastAttempt: Pick<BriefRunSummary, 'windowEnd'> | null, now = Date.now()) {
  const beijing = new Date(now + 8 * 60 * 60 * 1000);
  const todayNine = Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate(), 1);
  return now >= todayNine && (!lastAttempt || Date.parse(lastAttempt.windowEnd) < todayNine);
}

export function isPrecisionBriefProject(project: Content | null | undefined) {
  return Boolean(project?.isProject && project.type === 'folder' && project.scene === 'work' && project.description.includes(precisionBriefMarker));
}
export function precisionProjectSummary(project: Content) {
  return project.description.replaceAll(precisionBriefMarker, '').trim();
}
export const briefStatusLabels: Record<string, string> = { queued: '等待调度', running: '调研中', validating: '质检中', published: '已发布', failed: '运行失败', completed: '已完成', no_news: '无核实新增', pending: '待调研', success: '已完成', draft: '待发布' };
export function briefDate(value: string | null | undefined, withTime = false) {
  if (!value) return '尚未记录';
  const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(date);
}
export function sourcesForItem(item: BriefItem, sources: BriefSource[]) {
  return sources.filter(source => item.sourceIds.map(String).includes(source.key));
}
export function searchBriefSources(sources: BriefSource[], query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  return sources.filter(source => `${source.title} ${source.publisher} ${source.sourceType} ${source.url}`.toLocaleLowerCase().includes(keyword));
}
export function exportBriefMarkdown(run: BriefRun) {
  const sections = precisionSections.map(section => {
    const items = run.items.filter(item => item.section === section.key);
    return [`## ${section.short} ${section.title}`, items.length ? items.map(item => [
      `### ${item.severity === 'important' ? '⚠ ' : ''}${item.title}`,
      `消息：${item.message}`, `关注点：${item.attention}`, `点评：${item.commentary}`,
      ...sourcesForItem(item, run.sources).map(source => `- [${source.publisher}：${source.title}](${source.url}) · 发布 ${briefDate(source.publishedAt)} · 访问 ${briefDate(source.accessedAt)}`),
    ].join('\n\n')).join('\n\n') : '本时窗未发现经核实新增。'].join('\n\n');
  });
  return [`# PM·每日行业简报｜${run.issueDate}`, `资料窗口：${briefDate(run.windowStart, true)} 至 ${briefDate(run.windowEnd, true)}（北京时间）`, '## 本期要点', run.summary, ...sections].join('\n\n');
}
export function escapeBriefHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function exportBriefHtml(run: BriefRun) {
  const markup = precisionSections.map(section => {
    const items = run.items.filter(item => item.section === section.key);
    return `<section><h2>${section.short} ${section.title}</h2>${items.length ? items.map(item => `<article><h3>${item.severity === 'important' ? '⚠ ' : ''}${escapeBriefHtml(item.title)}</h3><p><b>消息：</b>${escapeBriefHtml(item.message)}</p><p><b>关注点：</b>${escapeBriefHtml(item.attention)}</p><p><b>点评：</b>${escapeBriefHtml(item.commentary)}</p><ul>${sourcesForItem(item, run.sources).map(source => `<li><a href="${escapeBriefHtml(source.url)}">${escapeBriefHtml(source.publisher)}：${escapeBriefHtml(source.title)}</a> · 发布 ${escapeBriefHtml(briefDate(source.publishedAt))} · 访问 ${escapeBriefHtml(briefDate(source.accessedAt))}</li>`).join('')}</ul></article>`).join('') : '<p>本时窗未发现经核实新增。</p>'}</section>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PM·每日行业简报 ${escapeBriefHtml(run.issueDate)}</title><style>body{font:16px/1.9 system-ui,sans-serif;color:#263c3d;max-width:900px;margin:auto;padding:28px}h1{font-size:28px}h2{font-size:22px;border-top:2px solid #386e76;padding-top:24px}article{border-bottom:1px solid #d7e2e2;padding-bottom:20px}a{color:#246e80}p,li{overflow-wrap:anywhere}</style></head><body><h1>PM·每日行业简报｜${escapeBriefHtml(run.issueDate)}</h1><p>资料窗口：${escapeBriefHtml(briefDate(run.windowStart, true))} 至 ${escapeBriefHtml(briefDate(run.windowEnd, true))}（北京时间）</p><h2>本期要点</h2><p>${escapeBriefHtml(run.summary)}</p>${markup}</body></html>`;
}
