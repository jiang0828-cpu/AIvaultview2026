import { formatLivelihoodCitations, livelihoodIssueMarker, livelihoodProjectMarker, livelihoodDataMarker, parseLivelihoodReport, type LivelihoodReport } from '../../backend/src/livelihoodSchema';
import type { Content } from './types';
export type { LivelihoodReport };
export { formatLivelihoodCitations };

export function isLivelihoodProject(content: Content) {
  return content.isProject === true && content.type === 'folder' && content.scene === 'system'
    && content.description.includes(livelihoodProjectMarker);
}

export function livelihoodIssues(project: Content) {
  return (project.children ?? []).filter((item) => item.type === 'folder' && item.description.includes(livelihoodIssueMarker))
    .sort((a, b) => b.sortOrder - a.sortOrder || b.id - a.id);
}

export function livelihoodSummary(project: Content) {
  return project.description.replaceAll(livelihoodProjectMarker, '').trim();
}

export function livelihoodIssueReport(issue: Content | undefined) {
  const records = (issue?.children ?? []).filter((item) => item.description.startsWith(livelihoodDataMarker));
  return records.length === 1 ? parseLivelihoodReport(records[0].description) : null;
}

export function livelihoodIssueDocuments(issue: Content, report: LivelihoodReport) {
  return report.sections.map((section) => issue.children?.find((document) => document.type === 'text' && document.title === section.documentTitle))
    .filter((document): document is Content => Boolean(document));
}

export const livelihoodDateLabels = { published: '网页发布', issued: '文件日期', accessed: '查阅' };
export const livelihoodFactLabels = { law: '法律与司法规则', policy: '政策与指引', data: '统计记录', case: '官方案例' };
export const livelihoodPriorityLabels = { immediate: '立即行动', ongoing: '持续改进', structural: '制度建设' };

export function exportLivelihoodMarkdown(report: LivelihoodReport, documents: Content[]) {
  const groups = [
    ...report.sections.map((item) => ({ name: item.title, sourceIds: item.sourceIds })),
    ...report.relationships.map((item) => ({ name: item.name, sourceIds: item.sourceIds })),
    ...report.facts.map((item) => ({ name: item.title, sourceIds: item.sourceIds })),
    ...report.problems.map((item) => ({ name: item.title, sourceIds: item.sourceIds })),
    ...report.mechanisms.map((item) => ({ name: item.title, sourceIds: item.sourceIds })),
    ...report.actions.map((item) => ({ name: item.title, sourceIds: item.sourceIds })),
    ...report.pathways.map((item) => ({ name: item.name, sourceIds: item.sourceIds })),
    ...report.helpChannels.map((item) => ({ name: item.title, sourceIds: item.sourceIds })),
  ];
  const evidenceTable = [
    '| 章节或工作表条目 | 参考条目编号 |', '| --- | --- |',
    ...groups.map((item) => `| ${item.name.replaceAll('|', '／')} | ${item.sourceIds.map((id) => report.sources.findIndex((source) => source.id === id) + 1).join('、')} |`),
  ].join('\n');
  return formatLivelihoodCitations([
    `# 碌碌无为｜第${report.number}期 ${report.title}`, report.subtitle, `资料截止：${report.asOf}`, report.introduction,
    report.boundary, '## 本期要点', ...report.takeaways.map((text) => `- ${text}`),
    ...report.sections.flatMap((section) => {
      const document = documents.find((item) => item.title === section.documentTitle);
      return [document?.description ?? `## ${section.title}\n\n${section.body}`];
    }),
    '## 办理与咨询入口', ...report.helpChannels.map((item) => `### ${item.title}\n\n电话：${item.phone}\n\n[官方入口](${item.url})\n\n${item.description}`),
    '## 附录：权益对照与行动工作表',
    '### 用工关系与权益对照', ...report.relationships.map((item) => `#### ${item.name}\n\n${item.situation}\n\n判断：${item.judgment}\n\n${item.rights.map((right) => `- ${right}`).join('\n')}\n\n边界：${item.limits}`),
    '### 事实与规则台账', ...report.facts.map((item) => `#### ${item.title}｜${livelihoodFactLabels[item.kind]}\n\n${item.detail}\n\n期间：${item.period}\n\n口径：${item.basis}`),
    '### 问题拆解', ...report.problems.map((item) => `#### ${item.title}\n\n影响：${item.impact}\n\n机制：${item.mechanism}\n\n替代解释与限制：${item.counter}`),
    '### 传导机制', ...report.mechanisms.map((item) => `#### ${item.title}\n\n${item.stages.join(' → ')}\n\n${item.explanation}\n\n替代解释：${item.alternative}`),
    '### 分主体行动方案', ...report.actions.map((item) => `#### ${item.title}｜${item.actor}｜${livelihoodPriorityLabels[item.priority]}\n\n触发：${item.trigger}\n\n${item.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n留存：${item.evidence}\n\n验收：${item.metric}\n\n局限：${item.limitation}`),
    '### 按场景寻找路径', ...report.pathways.map((item) => `#### ${item.name}\n\n适用：${item.when}\n\n先联系：${report.helpChannels.filter((channel) => item.contactIds.includes(channel.id)).map((channel) => `${channel.title} ${channel.phone} [官方入口](${channel.url})`).join('；')}\n\n第一次联系可这样说明：${item.firstContact}\n\n${item.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n证据：\n${item.evidence.map((value) => `- ${value}`).join('\n')}\n\n期限：${item.deadline}\n\n注意：${item.caveat}`),
    '## 个人证据清单', ...report.checklist.map((item) => `- ${item}`),
    '## 后续观察', ...report.watchlist.map((item) => `### ${item.indicator}\n\n${item.method}\n\n局限：${item.limitation}`),
    '## 结论', report.conclusion,
    '## 证据对应表', evidenceTable,
    '## 资料来源与支持范围',
    ...report.sources.map((source, index) => `- [${index + 1}｜${source.publisher}：${source.title}](${source.url})\n  ${livelihoodDateLabels[source.dateKind]}：${source.published}；定位：${source.locator}\n  支持范围：${source.scope}`),
  ].join('\n\n'), report);
}
