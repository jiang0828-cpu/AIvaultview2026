import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUpRight, Download, FileText } from 'lucide-react';
import type { ResearchStudyView } from './researchModel';

const sections = [
  ['executiveSummary', '执行摘要与四维发现'], ['marketOpportunity', '市场与支付'],
  ['targetUsers', '临床需求'], ['feasibility', '技术可行性'], ['competition', '竞争格局'],
  ['risks', '冲突与风险'], ['recommendation', 'BD策略与进入条件'],
] as const;

export function ResearchReport({ study, busy, onExport, onSource, onTask }: {
  study: ResearchStudyView; busy: boolean; onExport: () => void;
  onSource: (query: string) => void; onTask: (id: number) => void;
}) {
  const synthesis = study.synthesis;
  if (!synthesis) return <section className="research-section"><h2>调研报告</h2><p>本轮尚无综合研判报告。</p></section>;
  const entries = study.tasks.flatMap(task => task.sources.map(source => ({ task, source })));
  const uniqueSources = new Set(entries.map(({ source }) => source.url)).size;
  const cutoffs = [...new Set(study.tasks.map(task => task.asOf).filter(Boolean))].sort();
  const markdown = (text: string) => text.replace(/(\*\*[^*\n]+\*\*)(?=[\p{L}\p{N}])/gu, '$1 ').replace(/\[task#(\d+)\/([A-Za-z0-9_-]+)\]/g, (original, id, sourceId) => {
    const entry = entries.find(item => item.task.id === Number(id) && item.source.id === sourceId);
    return entry ? `[${sourceId} · 来源](#research-evidence-${id}-${sourceId})` : original;
  });
  return <div className="research-report">
    <section className="research-section">
      <div className="research-sectionheading"><h2>{study.title}</h2><button disabled={busy} onClick={onExport}><Download size={15} />导出完整报告</button></div>
      <p className={synthesis.status === 'stale' ? 'research-warning' : 'research-report-status'}>{synthesis.status === 'stale' ? '子任务已变更，本报告已失效，仅供历史参考。' : synthesis.status === 'reviewed' ? '负责人已审核' : '四维研究已提交 · 综合研判待负责人审核'}</p>
      <dl className="research-report-metrics">
        <div><dt>数据截止日期</dt><dd>{cutoffs.length === 1 ? cutoffs[0] : cutoffs.length ? `${cutoffs[0]} — ${cutoffs[cutoffs.length - 1]}` : '未填写'}</dd></div>
        <div><dt>研究维度</dt><dd>{study.tasks.length} 项</dd></div>
        <div><dt>原文地址去重</dt><dd>{uniqueSources} 项</dd></div>
        <div><dt>人工核实来源记录</dt><dd>{entries.filter(item => item.source.verified).length} / {entries.length}</dd></div>
      </dl>
    </section>
    <div className="research-report-layout">
      <nav className="research-report-toc" aria-label="调研报告目录">
        {sections.map(([key, label]) => <a key={key} href={`#report-${key}`}>{label}</a>)}
        <a href="#report-questions">补充调研清单</a>
        <button onClick={() => onSource('')}><FileText size={14} />完整来源台账</button>
      </nav>
      <div className="research-report-body">
        {sections.map(([key, label]) => <section id={`report-${key}`} key={key} className="research-section research-report-chapter" aria-label={label}>
          <div className="research-sectionheading"><h2>{label}</h2></div>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            table: ({ children }) => <div className="research-tablewrap"><table>{children}</table></div>,
            a: ({ href, children }) => {
              const match = href?.match(/^#research-evidence-(\d+)-([A-Za-z0-9_-]+)$/);
              const entry = match && entries.find(item => item.task.id === Number(match[1]) && item.source.id === match[2]);
              return entry ? <a href={href} title={entry.source.title} onClick={event => { event.preventDefault(); onSource(entry.source.title); }}>{children}</a> : <a href={href} target="_blank" rel="noreferrer">{children}</a>;
            },
          }}>{markdown(synthesis[key])}</ReactMarkdown>
        </section>)}
        <section id="report-questions" className="research-section"><h2>补充调研清单</h2><ol>{synthesis.openQuestions.map((question, index) => <li key={index}>{question}</li>)}</ol></section>
        <section className="research-section"><h2>四维研究原文</h2><div className="research-report-tasklinks">{study.tasks.map(task => <button key={task.id} onClick={() => onTask(task.id)}>{task.title}<ArrowUpRight size={14} /></button>)}</div></section>
      </div>
    </div>
  </div>;
}
