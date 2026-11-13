import { formatLivelihoodCitations, livelihoodDataMarker, livelihoodIssueMarker } from '../src/livelihoodSchema.js';
import { livelihoodReport001 as report } from './livelihood-001-data.js';

export const livelihoodIssue001 = {
  title: `第${report.number}期｜${report.title}`, type: 'folder' as const, isProject: false, scene: 'system' as const,
  sortOrder: 1, topics: report.tags,
  description: `${livelihoodIssueMarker}\n${report.subtitle}\n资料截止：${report.asOf}。${report.introduction}`,
};

export const livelihoodDataDocument001 = {
  title: '00 本期数据与来源', type: 'text' as const, scene: 'system' as const, sortOrder: 0,
  topics: ['劳动权益', '来源'], description: `${livelihoodDataMarker}\n${JSON.stringify(report, null, 2)}`,
};

export const livelihoodChapters001 = report.sections.map((section, index) => ({
  title: section.documentTitle, type: 'text' as const, scene: 'system' as const, sortOrder: index + 1,
  topics: [section.title, '劳动权益'],
  description: formatLivelihoodCitations(`# ${section.title}：${section.question}\n\n> 第${report.number}期｜资料截止：${report.asOf}\n\n${section.summary}\n\n${section.body}\n\n## 参考来源\n\n${report.sources.filter((source) => section.sourceIds.includes(source.id)).map((source) => `- [${source.id}｜${source.publisher}：${source.title}](${source.url})。${source.scope} 定位：${source.locator}`).join('\n')}\n\n${index === report.sections.length - 1 ? report.conclusion : ''}`, report),
}));
