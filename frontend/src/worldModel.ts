import { calculateWorldEvidence, parseWorldReport, worldDataMarker, worldIssueMarker, worldProjectMarker, type WorldReport } from '../../backend/src/worldSchema';
import type { Content } from './types';
export type { WorldReport };
const kindNames = { observed: '公布值', forecast: '机构预测', policy: '政策目标', study: '研究估计', calculated: '计算值' };
export const timelineStatusNames = { confirmed: '公告或披露', reported: '媒体报道', position: '公开表态', filed: '诉状已提交', scheduled: '已公告议程' };
export type WorldEvidenceReview = NonNullable<WorldReport['evidenceReview']>;
export const evidenceKindNames = { data: '数据', fact: '已核实事实', statement: '公开表态', allegation: '未证实主张' };
export const evidenceLevelNames = { supported: '证据支持', bounded: '仅支持有限判断', insufficient: '证据不足', conditional: '条件推演' };

export function worldEvidenceCalculation(calculation: WorldEvidenceReview['calculations'][number], review: WorldEvidenceReview) {
  const left = review.records.find((record) => record.id === calculation.left)!;
  const right = review.records.find((record) => record.id === calculation.right)!;
  const leftValue = left.value!;
  const rightValue = right.value!;
  const formula = {
    difference: `${leftValue} − (${rightValue})`,
    share: `${leftValue} ÷ (${rightValue}) × 100`,
    growth: `(${leftValue} ÷ (${rightValue}) − 1) × 100`,
  }[calculation.operation];
  return { left, right, formula, result: `${calculateWorldEvidence(calculation, review.records).toFixed(calculation.decimals)} ${calculation.unit}` };
}

export function worldClaimRecords(claim: WorldEvidenceReview['claims'][number], review: WorldEvidenceReview) {
  const inputIds = new Set(claim.recordIds);
  for (const calculation of review.calculations.filter((item) => claim.calculationIds.includes(item.id))) {
    inputIds.add(calculation.left);
    inputIds.add(calculation.right);
  }
  return review.records.filter((record) => inputIds.has(record.id));
}

function worldEvidenceMarkdown(review: WorldEvidenceReview) {
  return [
    '## 证据与论证', `复核日期：${review.revisedOn}`, review.scope, review.method,
    '### 数据与事实', '源头分组用于去重。同一份原始资料的多次引用不构成独立佐证；不同源头也不等同于因果验证。',
    ...review.records.map((record) => `- [${record.id}] ${record.title}｜${evidenceKindNames[record.kind]}${record.value === undefined ? '' : `｜${record.value} ${record.unit ?? ''}`}\n  期间：${record.period}；源头组：${record.origin}；口径与边界：${record.basis}；来源：[${record.sourceIds.join(', ')}]`),
    ...(review.calculations.length ? ['### 可复算指标', ...review.calculations.map((calculation) => {
      const { left, right, formula, result } = worldEvidenceCalculation(calculation, review);
      return `- [${calculation.id}] ${calculation.title}：${formula} = ${result}\n  输入：${left.title} [${left.id}]；${right.title} [${right.id}]。${calculation.note}`;
    })] : []),
    '### 结论、反证与验证条件',
    ...review.claims.map((claim) => {
      const records = worldClaimRecords(claim, review);
      const origins = [...new Set(records.map((record) => record.origin))];
      return `#### ${claim.title}｜${evidenceLevelNames[claim.level]}\n\n${claim.conclusion}\n\n推理：${claim.reasoning}\n\n反证或替代解释：${claim.counter}\n\n验证条件：${claim.verify}\n\n引用证据：${records.map((record) => `[${record.id}] ${record.title}`).join('；') || '无直接证据'}\n\n引用计算：${claim.calculationIds.map((id) => `[${id}]`).join('；') || '无'}\n\n源头组：${origins.join('；') || '无'}`;
    }),
  ];
}

export function isWorldProject(content: Content) {
  return content.type === 'folder' && content.scene === 'system' && content.description.includes(worldProjectMarker);
}
export function worldIssues(project: Content) {
  return (project.children || []).filter((item) => item.type === 'folder' && item.description.includes(worldIssueMarker))
    .sort((a, b) => b.sortOrder - a.sortOrder || b.id - a.id);
}
export function worldIssueData(issue: Content | undefined) {
  const rows = (issue?.children || []).filter((item) => item.description.startsWith(worldDataMarker));
  return rows.length === 1 ? parseWorldReport(rows[0].description) : null;
}
export function exportWorldMarkdown(report: WorldReport, documents: Content[]) {
  const sections = [`# 观天下｜第${report.number}期 ${report.title}`, report.subtitle, `资料截止：${report.asOf}`, report.thesis, report.boundary,
    ...(report.evidenceReview ? worldEvidenceMarkdown(report.evidenceReview) : []),
    ...(report.timeline ? ['## 事件时间线', ...report.timeline.map((event) => `- ${event.date}｜${timelineStatusNames[event.status]}｜${event.title}：${event.detail} [${event.sourceIds.join(', ')}]`)] : []),
    '## 数据快照', ...report.metrics.map((metric) => `- ${metric.label}：${metric.value}${metric.unit}；${metric.period}；${kindNames[metric.kind]}；${metric.note} [${metric.sourceIds.join(', ')}]`),
    '## 图表数据', ...report.charts.map((chart) => `### ${chart.title}\n\n${chart.subtitle}\n\n${chart.rows.map((row) => `- ${row.label}：${row.value}${chart.unit} (${kindNames[row.kind]})`).join('\n')}\n\n${chart.note} [${chart.sourceIds.join(', ')}]`),
    ...documents.map((document) => document.description), '## 传导机制（编辑分析）',
    ...report.channels.map((channel) => `### ${channel.title}\n\n${channel.stages.map((stage) => `${stage.label}：${stage.detail}`).join(' → ')}\n\n${channel.feedback}\n\n${channel.caveat}`),
    '## 条件情景（非概率预测）', ...report.scenarios.map((scenario) => `### ${scenario.name}\n\n${scenario.premise}\n\n触发条件：\n\n${scenario.conditions.map((condition) => `- ${condition}`).join('\n')}\n\n${report.scenarioAudience?.business ?? '企业'}：${scenario.business}\n\n${report.scenarioAudience?.household ?? '家庭'}：${scenario.household}\n\n证伪条件：${scenario.invalidation}`),
    '## 观察清单', ...report.watchlist.map((item) => `### ${item.dimension}：${item.indicator}\n\n频率：${item.frequency}\n\n观察：${item.signal}\n\n替代解释：${item.alternative}`),
    '## 来源与支持范围', ...report.sources.map((source) => `- [${source.id}｜${source.publisher}：${source.title}](${source.url})\n  发布：${source.published}；统计期：${source.period}\n  支持范围：${source.scope}`)];
  return sections.join('\n\n');
}
