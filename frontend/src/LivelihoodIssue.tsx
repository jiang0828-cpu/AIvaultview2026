import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock3, CheckCheck, Download, ExternalLink, FileCheck2, Phone, Search, ShieldCheck } from 'lucide-react';
import { ContentBody } from './components';
import type { Content } from './types';
import { exportLivelihoodMarkdown, formatLivelihoodCitations, livelihoodDateLabels, livelihoodFactLabels, livelihoodIssueDocuments, livelihoodPriorityLabels, type LivelihoodReport } from './livelihoodModel';
import './livelihood-issue.css';

const tabs = [ ['situation', '现状'], ['problems', '问题'], ['analysis', '分析'], ['solutions', '方案'], ['sources', '资料来源'] ] as const;

function References({ ids, report }: { ids: string[]; report: LivelihoodReport }) {
  return <details className="livelihood-source-note"><summary>依据</summary><span className="livelihood-references">{ids.map((id) => {
    const source = report.sources.find((item) => item.id === id);
    return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.publisher}：${source.title}`}>[{report.sources.indexOf(source) + 1}]<ExternalLink size={10} /></a> : null;
  })}</span></details>;
}

export function LivelihoodIssue({ issue, report, onBack }: { issue: Content; report: LivelihoodReport; onBack: () => void }) {
  const [params, setParams] = useSearchParams();
  const section = tabs.find(([key]) => key === params.get('lifeSection'))?.[0] ?? 'situation';
  const [relationId, setRelationId] = useState(report.relationships[0].id);
  const [pathwayId, setPathwayId] = useState(report.pathways[0].id);
  const [actor, setActor] = useState('all');
  const [query, setQuery] = useState('');
  const relation = report.relationships.find((item) => item.id === relationId)!;
  const pathway = report.pathways.find((item) => item.id === pathwayId)!;
  const documents = livelihoodIssueDocuments(issue, report);
  const currentSection = report.sections.find((item) => item.id === section);
  const rawDocument = documents.find((item) => item.title === currentSection?.documentTitle);
  const activeDocument = rawDocument ? { ...rawDocument, description: formatLivelihoodCitations(rawDocument.description, report) } : undefined;
  const sourceMatches = report.sources.filter((item) => `${item.id} ${item.title} ${item.publisher} ${item.scope}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function selectSection(key: string) {
    const next = new URLSearchParams(params);
    next.set('lifeSection', key);
    setParams(next);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportLivelihoodMarkdown(report, documents)], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `碌碌无为-${report.number}-${report.asOf}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="livelihood-issue" aria-labelledby="livelihood-issue-title">
    <div className="livelihood-issue-toolbar"><button className="back-link" onClick={onBack}><ArrowLeft size={15} />期次档案</button><button className="livelihood-download" onClick={download}><Download size={15} />下载完整报告</button></div>
    <header className="livelihood-issue-header"><p className="livelihood-eyebrow">碌碌无为 / 第 {report.number} 期 / {report.asOf}</p><h2 id="livelihood-issue-title">{report.title}</h2><p className="livelihood-issue-subtitle">{report.subtitle}</p><p>{report.introduction}</p></header>
    <div className="livelihood-takeaways" aria-label="本期要点">{report.takeaways.map((item) => <p key={item}><CheckCheck size={17} />{item}</p>)}</div>
    <nav className="livelihood-issue-nav" aria-label="首期专题导航">{tabs.map(([key, label]) => <button key={key} aria-current={section === key ? 'page' : undefined} onClick={() => selectSection(key)}>{label}</button>)}</nav>
    {section === 'solutions' && report.helpChannels.length > 0 && <section className="livelihood-help" aria-label="办理与咨询入口"><h3>先找到能受理这件事的入口</h3><div>{report.helpChannels.map((channel) => <article key={channel.id}><h4>{channel.title}</h4><a className="livelihood-help-phone" href={`tel:${channel.phone}`}><Phone size={17} />{channel.phone}</a><p>{channel.description}</p><a href={channel.url} target="_blank" rel="noopener noreferrer">官方服务入口<ExternalLink size={14} /></a><References ids={channel.sourceIds} report={report} /></article>)}</div></section>}
    {currentSection && <section className="livelihood-section">{activeDocument ? <ContentBody content={activeDocument} /> : <><div className="livelihood-section-heading"><p className="livelihood-eyebrow">{currentSection.title}</p><h3>{currentSection.question}</h3><p>{currentSection.summary}</p></div><p className="livelihood-missing" role="status">章节文档暂缺，以下显示本期存档正文。</p><ContentBody content={{ ...issue, type: 'text', description: formatLivelihoodCitations(currentSection.body, report) }} /></>}<References ids={currentSection.sourceIds} report={report} /></section>}
    {section === 'situation' && <>
      <section className="livelihood-relation"><div className="livelihood-section-heading"><h3>先辨认用工安排，再核对权益</h3><p>下面是核对线索，不能代替个案中的劳动关系认定。</p></div><label className="livelihood-select">选择用工安排<select aria-label="选择用工安排" value={relationId} onChange={(event) => setRelationId(event.target.value)}>{report.relationships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><article><h4>{relation.name}</h4><p>{relation.situation}</p><dl><div><dt>怎么判断</dt><dd>{relation.judgment}</dd></div><div><dt>重点权益</dt><dd><ul>{relation.rights.map((right) => <li key={right}>{right}</li>)}</ul></dd></div><div><dt>适用边界</dt><dd>{relation.limits}</dd></div></dl><References ids={relation.sourceIds} report={report} /></article></section>
      <section className="livelihood-facts"><div className="livelihood-section-heading"><h3>规则在变化，适用范围也要一起看</h3></div>{report.facts.map((fact) => <article key={fact.id}><div><span>{livelihoodFactLabels[fact.kind]}</span><time>{fact.period}</time></div><h4>{fact.title}</h4><p>{fact.detail}</p><details><summary>口径与来源</summary><p>{fact.basis}</p><References ids={fact.sourceIds} report={report} /></details></article>)}</section>
    </>}
    {section === 'problems' && <section className="livelihood-problem-list" aria-label="问题拆解">{report.problems.map((problem, index) => <article key={problem.id}><span className="livelihood-problem-number">{String(index + 1).padStart(2, '0')}</span><h3>{problem.title}</h3><p>{problem.impact}</p><dl><div><dt>怎样产生</dt><dd>{problem.mechanism}</dd></div><div><dt>还要排除</dt><dd>{problem.counter}</dd></div></dl><References ids={problem.sourceIds} report={report} /></article>)}</section>}
    {section === 'analysis' && <section className="livelihood-mechanisms" aria-label="机制与替代解释">{report.mechanisms.map((item) => <article key={item.id}><h3>{item.title}</h3><ol>{item.stages.map((stage, index) => <li key={stage}><span>{stage}</span>{index < item.stages.length - 1 && <ArrowRight size={15} />}</li>)}</ol><p>{item.explanation}</p><details><summary>替代解释与限制</summary><p>{item.alternative}</p></details><References ids={item.sourceIds} report={report} /></article>)}</section>}
    {section === 'solutions' && <>
      <section className="livelihood-pathways">
        <div className="livelihood-section-heading"><p className="livelihood-eyebrow">遇到问题之后</p><h3>按你的具体处境，找下一步</h3></div>
        <label className="livelihood-select">选择问题<select aria-label="选择维权场景" value={pathwayId} onChange={(event) => setPathwayId(event.target.value)}>{report.pathways.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <article><h4>{pathway.name}</h4><p>{pathway.when}</p>
          {pathway.contactIds.length > 0 && <div className="livelihood-pathway-contact"><strong>先联系</strong><div>{report.helpChannels.filter((channel) => pathway.contactIds.includes(channel.id)).map((channel) => <span key={channel.id}><a href={`tel:${channel.phone}`}><Phone size={15} />{channel.phone}</a><a href={channel.url} target="_blank" rel="noopener noreferrer">{channel.title}<ExternalLink size={12} /></a></span>)}</div><p><b>第一次联系可这样说明：</b>{pathway.firstContact}</p><small>咨询或平台报案后，仍须向有权机构正式提交所需申请，索取载明时间的收件证明、案号或答复；无法接通时查所在地官方窗口。</small></div>}
          <ol>{pathway.steps.map((step) => <li key={step}>{step}</li>)}</ol><div className="livelihood-deadline"><ClockLabel /><p>{pathway.deadline}</p></div><details open><summary>要带哪些证据</summary><ul>{pathway.evidence.map((item) => <li key={item}>{item}</li>)}</ul></details><p className="livelihood-caveat">{pathway.caveat}</p><References ids={pathway.sourceIds} report={report} />
        </article>
      </section>
      <section className="livelihood-actions"><div className="livelihood-section-heading"><h3>保障权益，不能只让劳动者独自承担成本</h3></div><label className="livelihood-select">责任主体<select aria-label="筛选责任主体" value={actor} onChange={(event) => setActor(event.target.value)}><option value="all">全部主体</option>{[...new Set(report.actions.map((item) => item.actor))].map((name) => <option key={name}>{name}</option>)}</select></label><div>{report.actions.filter((item) => actor === 'all' || item.actor === actor).map((action) => <article key={action.id}><p className="livelihood-eyebrow">{action.actor} · {livelihoodPriorityLabels[action.priority]}</p><h4>{action.title}</h4><p>{action.trigger}</p><ol>{action.steps.map((step) => <li key={step}>{step}</li>)}</ol><dl><div><dt>留存记录</dt><dd>{action.evidence}</dd></div><div><dt>建议验收</dt><dd>{action.metric}</dd></div><div><dt>代价与局限</dt><dd>{action.limitation}</dd></div></dl><References ids={action.sourceIds} report={report} /></article>)}</div></section>
      <section className="livelihood-checklist"><h3><FileCheck2 size={19} />给自己留一份证据</h3><ul>{report.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section className="livelihood-watchlist"><h3>后续观察：看落实，不只看文件</h3>{report.watchlist.map((item) => <article key={item.indicator}><h4>{item.indicator}</h4><p>{item.method}</p><small>{item.limitation}</small></article>)}</section>
    </>}
    {section === 'sources' && <section className="livelihood-sources"><div className="livelihood-section-heading"><h3>原文、适用范围与条文定位</h3><p>法律规则、政策指引、统计记录与案例分别使用；不把某个案件结果推广给所有人。</p></div><label className="livelihood-source-search"><Search size={17} /><input aria-label="检索本期来源" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索机构、标题或支持范围" /></label>{sourceMatches.map((source) => <article key={source.id}><p className="livelihood-eyebrow">{report.sources.indexOf(source) + 1} · {source.publisher}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={15} /></a><p>{source.scope}</p><small>{livelihoodDateLabels[source.dateKind]}：{source.published} · {source.locator}</small></article>)}{!sourceMatches.length && <p role="status">没有匹配来源。</p>}</section>}
    <footer className="livelihood-issue-footer"><ShieldCheck size={19} /><div><strong>{report.conclusion}</strong><p>{report.boundary}</p></div></footer>
  </section>;
}

function ClockLabel() { return <span><Clock3 size={16} />不要忽略期限</span>; }
