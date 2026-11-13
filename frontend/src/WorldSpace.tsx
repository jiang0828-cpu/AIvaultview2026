import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesCombined, Check, ChevronRight, Compass, Download, ExternalLink, GitBranch, Globe2, Landmark, Layers3, Lightbulb, ListChecks, Radio, Search, ShieldCheck, Users, Cpu, Building2, Calculator, FileCheck2, Siren } from 'lucide-react';
import { ContentBody, TopicPills } from './components';
import { api } from './api';
import type { Content } from './types';
import { evidenceKindNames, evidenceLevelNames, exportWorldMarkdown, timelineStatusNames, worldClaimRecords, worldEvidenceCalculation, worldIssueData, worldIssues, worldSourceDate, type WorldReport } from './worldModel';
import './world.css';

const views = [
  { key: 'overview', name: '项目概览', Icon: Compass }, { key: 'evidence', name: '证据与论证', Icon: FileCheck2 },
  { key: 'analysis', name: '专题解读', Icon: BookOpen }, { key: 'responses', name: '应对措施', Icon: Siren }, { key: 'transmission', name: '传导与情景', Icon: GitBranch }, { key: 'watch', name: '观察清单', Icon: ListChecks },
  { key: 'sources', name: '资料来源', Icon: Layers3 },
];
const lensIcons = [Landmark, Globe2, ChartNoAxesCombined, Building2, Users, Cpu];
const kindNames = { observed: '公布值', forecast: '机构预测', policy: '政策目标', study: '研究估计', calculated: '计算值' };

function SourceLinks({ ids, report }: { ids: string[]; report: WorldReport }) {
  return <span className="world-refs">{ids.map((id) => {
    const source = report.sources.find((item) => item.id === id);
    if (!source) return null;
    return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.publisher}｜${source.title}`}>[{id}]<ExternalLink size={10} /></a>;
  })}</span>;
}
function DataChart({ chart, report }: { chart: WorldReport['charts'][number]; report: WorldReport }) {
  return <figure className="world-chart"><figcaption><h3>{chart.title}</h3><p>{chart.subtitle}</p></figcaption>
    <div className="world-chart-scale"><span>0</span><span>{chart.max / 2}</span><span>{chart.max}{chart.unit}</span></div>
    <div className="world-chart-rows">{chart.rows.map((row) => <div className="world-chart-row" key={row.label}>
      <span>{row.label}</span><div className="world-chart-track"><div className={`world-chart-bar ${row.kind}`} style={{ width: `${row.value / chart.max * 100}%` }} /></div><strong aria-label={`${row.value}${chart.unit}`}>{row.value.toFixed(1)}{chart.unit === '%' ? chart.unit : ''}</strong>
    </div>)}</div><p className="world-caption">{chart.note} <SourceLinks ids={chart.sourceIds} report={report} /></p>
  </figure>;
}

function IssueTimeline({ report }: { report: WorldReport }) {
  if (!report.timeline) return null;
  return <section aria-labelledby="world-timeline-title">
    <div className="world-section-heading"><div><p className="world-kicker">TIMELINE / 事件与证据</p><h2 id="world-timeline-title">来龙去脉与下一步</h2><p>研究、公开文件与治理进程，按事件日期排列</p></div></div>
    <ol className="world-timeline">{report.timeline.map((event) => <li key={`${event.date}-${event.title}`}>
      <div className="world-timeline-meta"><time dateTime={event.date}>{event.date}</time><span className={`world-timeline-status ${event.status}`}>{timelineStatusNames[event.status]}</span></div>
      <h3>{event.title}</h3><p>{event.detail}</p><SourceLinks ids={event.sourceIds} report={report} />
    </li>)}</ol>
  </section>;
}

function EvidenceReview({ report }: { report: WorldReport }) {
  const review = report.evidenceReview;
  if (!review) return <div className="world-empty" role="status"><h2>本期尚未建立证据审计</h2><p>数据、事实、论证和推演将按同一套口径逐期补齐。</p></div>;
  const origins = [...new Set(review.records.map((record) => record.origin))];
  return <section className="world-evidence" aria-labelledby="world-evidence-title">
    <div className="world-section-heading"><div><p className="world-kicker">EVIDENCE &amp; ARGUMENT / 证据审计</p><h2 id="world-evidence-title">先证据，后解释</h2><p>复核日期：{review.revisedOn} · {review.scope}</p></div><span className="world-muted"><FileCheck2 size={15} /> {review.records.length} 条证据记录</span></div>
    <div className="world-evidence-method"><FileCheck2 size={18} /><div><strong>论证顺序</strong><p>{review.method}</p><small>同一原始资料的多次转载不算独立佐证；不同来源也不自动构成因果证据。</small></div></div>
    <div className="world-evidence-section"><div className="world-section-heading"><div><p className="world-kicker">01 / RECORDS</p><h3>原始数据与事实</h3><p>按源头组去重，保留期间、口径和支持范围。</p></div></div><div className="world-evidence-origins">{origins.map((origin) => <section key={origin}><h4>{origin}</h4><div className="world-evidence-records">{review.records.filter((record) => record.origin === origin).map((record) => <article id={`world-record-${record.id}`} key={record.id}><div className="world-evidence-record-head"><span>{record.id}</span><b>{evidenceKindNames[record.kind]}</b>{record.value !== undefined && <strong>{record.value} {record.unit}</strong>}</div><h4>{record.title}</h4><p>{record.basis}</p><small>期间：{record.period} · 来源：<SourceLinks ids={record.sourceIds} report={report} /></small></article>)}</div></section>)}</div></div>
    {review.calculations.length > 0 && <div className="world-evidence-section"><div className="world-section-heading"><div><p className="world-kicker">02 / CALCULATIONS</p><h3>可复算指标</h3><p>每个结果都显示输入、公式和单位，避免把推导值伪装成公布值。</p></div></div><div className="world-evidence-calculations">{review.calculations.map((calculation) => { const { left, right, formula, result } = worldEvidenceCalculation(calculation, review); return <article key={calculation.id}><div><Calculator size={17} /><span>{calculation.id}</span></div><h4>{calculation.title}</h4><strong>{result}</strong><p className="world-formula">{formula}</p><small>输入：{left.title}（{left.value}）与 {right.title}（{right.value}）</small><p>{calculation.note}</p></article>; })}</div></div>}
    <div className="world-evidence-section"><div className="world-section-heading"><div><p className="world-kicker">03 / CLAIMS</p><h3>结论、反证与验证条件</h3><p>证据支持、有限判断、证据不足和条件推演明确分开。</p></div></div><div className="world-evidence-claims">{review.claims.map((claim) => { const records = worldClaimRecords(claim, review); return <article key={claim.id} className={`world-evidence-claim ${claim.level}`}><div className="world-evidence-claim-label"><span>{claim.id}</span><b>{evidenceLevelNames[claim.level]}</b></div><h4>{claim.title}</h4><p className="world-claim-conclusion">{claim.conclusion}</p><dl><div><dt>为什么这样判断</dt><dd>{claim.reasoning}</dd></div><div><dt>反证或替代解释</dt><dd>{claim.counter}</dd></div><div><dt>下一步怎么验证</dt><dd>{claim.verify}</dd></div></dl><div className="world-claim-references"><span>证据：</span>{records.length ? records.map((record) => <a key={record.id} href={`#world-record-${record.id}`} title={record.title}>{record.id}</a>) : <span>无直接证据</span>}{claim.calculationIds.length > 0 && <span>计算：{claim.calculationIds.join('、')}</span>}</div><small>源头组：{[...new Set(records.map((record) => record.origin))].join('；') || '无'}</small></article>; })}</div></div>
  </section>;
}

export function WorldSpace({ project, onBack, livelihood, onOpen }: { project: Content; onBack: () => void; livelihood?: Content; onOpen?: (content: Content) => void }) {
  const [params, setParams] = useSearchParams();
  const issues = worldIssues(project);
  const requestedIssue = params.get('issue');
  const issue = requestedIssue ? issues.find((item) => String(item.id) === requestedIssue) : issues[0];
  const report = worldIssueData(issue);
  const issueViews = views.filter((item) => (item.key !== 'evidence' || report?.evidenceReview) && (item.key !== 'responses' || report?.responses?.length));
  const view = issueViews.find((item) => item.key === params.get('worldView'))?.key || 'overview';
  const lens = report?.lenses.find((item) => item.id === params.get('lens')) || report?.lenses[0];
  const scenario = report?.scenarios.find((item) => item.id === params.get('scenario')) || report?.scenarios[0];
  const channel = report?.channels.find((item) => item.id === params.get('channel')) || report?.channels[0];
  const documents = (issue?.children || []).filter((item) => report?.lenses.some((lens) => lens.documentTitle === item.title));
  const activeDoc = documents.find((item) => item.title === lens?.documentTitle);
  const method = project.children?.find((item) => item.title === '栏目说明与选题模板');
  const [sourceQuery, setSourceQuery] = useState('');
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams({ project: String(project.id), ...(issue ? { issue: String(issue.id) } : {}), worldView: view });
    for (const key of ['lens', 'scenario', 'channel']) { const value = params.get(key); if (value) next.set(key, value); }
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next);
  };
  useEffect(() => {
    if (view === 'analysis' && activeDoc) void api('/log', { method: 'POST', body: JSON.stringify({ contentId: activeDoc.id, action: 'view_text' }) }).catch(() => {});
  }, [view, activeDoc]);
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([exportWorldMarkdown(report, documents)], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `观天下-${report.number}-${report.asOf}.md`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const selectedSources = report?.sources.filter((source) => `${source.id} ${source.publisher} ${source.title} ${source.scope}`.toLowerCase().includes(sourceQuery.trim().toLowerCase())) || [];

  return <section className="world-space" aria-labelledby="world-title">
    <div className="world-topline"><button className="back-link" onClick={onBack}><ArrowLeft size={14} />空间概览</button><span><Globe2 size={13} />系统管理 / 宏观环境分析</span></div>
    <header className="world-hero"><img src={project.coverUrl || '/media/projects/world/earth-night.jpg'} alt="2012年地球夜间灯光合成图，呈现全球人类活动的空间分布" /><div className="world-hero-copy">
      <p>WORLD OBSERVATORY / 宏观视野 · 社会切面</p><h1 id="world-title">观天下</h1><p className="world-hero-subtitle">看见变化，理解身处其中的我们。</p>
      <div className="world-hero-foot"><span><Radio size={13} />一期一题 · 六维拆解</span><span>{report ? `VOL. ${report.number} / ${report.asOf.replaceAll('-', '.')}` : '主题档案'}</span></div>
    </div></header>
    <div className="world-edition-bar"><label>期次档案<select aria-label="观天下期次" value={issue?.id || ''} onChange={(event) => update({ issue: event.target.value, worldView: 'overview', lens: '', scenario: '', channel: '' })}>{!issue && <option value="">请选择有效期次</option>}{issues.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><button className="world-download" title="下载本期完整Markdown报告" disabled={!report} onClick={download}><Download size={15} /><span>下载本期</span></button></div>
    {livelihood && onOpen && <section className="world-livelihood-entry" aria-label="微观与民生观察项目"><div><p>微观与民生观察 · 一期一主题</p><strong>{livelihood.title}</strong></div><button onClick={() => onOpen(livelihood)}>进入项目<ArrowUpRight size={16} /></button></section>}
    <nav className="world-nav" aria-label="观天下导航">{issueViews.map(({ key, name, Icon }) => <button key={key} aria-current={view === key ? 'page' : undefined} className={view === key ? 'active' : ''} onClick={() => update({ worldView: key })}><Icon size={15} />{name}</button>)}</nav>
    {!report || !issue ? <div className="world-empty" role="alert"><h2>{requestedIssue && !issue ? '未找到该期次' : '本期期次数据尚未完整'}</h2><p>请核对期次目录中的数据与来源文档；已有正文仍保留在资料库中。</p><button className="button" onClick={() => { const next = new URLSearchParams({ project: String(project.id) }); setParams(next); }}>返回最新一期</button></div> : <>
      {view === 'overview' && <>
        <div className="world-section-heading"><div><p className="world-kicker">THE QUESTION / 第 {report.number} 期</p><h2>{report.title}</h2><p>{report.subtitle}</p></div><button className="text-link" onClick={() => update({ worldView: 'analysis' })}>阅读本期<ArrowUpRight size={17} /></button></div>
        <div className="world-thesis"><span>本期判断</span><p>{report.thesis}</p><small>编辑分析 · 六个维度，检验同一个问题</small>{report.evidenceReview && <button className="text-link world-evidence-entry" onClick={() => update({ worldView: 'evidence' })}><FileCheck2 size={14} />查看证据与论证</button>}</div>
        <div className="world-metrics">{report.metrics.map((metric) => <div key={metric.label}><div className="world-metric-label">{metric.label}<span className={`world-kind ${metric.kind}`}>{kindNames[metric.kind]}</span></div><strong>{metric.value}<small>{metric.unit}</small></strong><p>{metric.period}</p><small>{metric.note}</small><SourceLinks ids={metric.sourceIds} report={report} /></div>)}</div>
        {report.takeaways && <section className="world-takeaways" aria-label="本期要点">{report.takeaways.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p><SourceLinks ids={item.sourceIds} report={report} /></article>)}</section>}
        <div className="world-chart-grid">{report.charts.map((chart) => <DataChart chart={chart} report={report} key={chart.id} />)}</div>
        <IssueTimeline report={report} />
        <div className="world-section-heading"><div><p className="world-kicker">SIX PERSPECTIVES</p><h2>从六个方向，看同一场变化</h2></div><span className="world-muted">事实 → 机制 → 反证 → 观察</span></div>
        <div className="world-lens-grid">{report.lenses.map((item, index) => { const Icon = lensIcons[index % lensIcons.length]; return <button className="world-lens-card" key={item.id} onClick={() => update({ worldView: 'analysis', lens: item.id })}><div><Icon size={21} /><span>0{index + 1}</span></div><h3>{item.name}</h3><strong>{item.question}</strong><p>{item.summary}</p><span className="world-lens-open">展开解读<ArrowRight size={15} /></span></button>; })}</div>
        <section className="world-agenda"><div><p className="world-kicker">NEXT QUESTIONS</p><h2>接下来，继续追问</h2><p>本期归档时的候选议题</p></div><ol>{report.agenda.map((item) => <li key={item.title}><strong>{item.title}</strong><p>{item.question}</p></li>)}</ol></section>
      </>}
      {view === 'evidence' && <EvidenceReview report={report} />}
      {view === 'analysis' && lens && <section className="world-analysis">
        <div className="world-section-heading"><div><p className="world-kicker">DEEP READ / 专题解读</p><h2>{report.title}</h2></div><span className="world-muted">六维分析 · 可追溯正文</span></div>
        <div className="world-lens-tabs" role="tablist" aria-label="分析维度">{report.lenses.map((item, index) => { const Icon = lensIcons[index % lensIcons.length]; return <button role="tab" id={`world-tab-${item.id}`} aria-selected={lens.id === item.id} aria-controls="world-analysis-panel" key={item.id} onClick={() => update({ lens: item.id })}><Icon size={16} />{item.name}</button>; })}</div>
        <div id="world-analysis-panel" role="tabpanel" aria-labelledby={`world-tab-${lens.id}`} className="world-analysis-panel"><div className="world-reading-head"><p className="world-kicker">{lens.name}</p><h3>{lens.question}</h3><p>{lens.summary}</p><SourceLinks ids={lens.sourceIds} report={report} /></div>
          <div className="world-reading-layout"><article className="world-prose">{activeDoc ? <ContentBody content={activeDoc} /> : <div role="alert" className="world-empty">本维度正文缺失，请在本期目录补齐“{lens.documentTitle}”。</div>}</article><aside className="world-reading-notes"><section><ShieldCheck size={18} /><h4>事实锚点</h4><p>{lens.fact}</p><SourceLinks ids={lens.sourceIds} report={report} /></section><section><Lightbulb size={18} /><h4>反向检验</h4><p>{lens.counter}</p></section><section><Search size={18} /><h4>继续观察</h4><p>{lens.watch}</p></section></aside></div>
          <div className="world-read-next"><button className="text-link" onClick={() => update({ lens: report.lenses[(report.lenses.findIndex((item) => item.id === lens.id) + 1) % report.lenses.length].id })}>下一维度<ChevronRight size={16} /></button><button className="text-link" onClick={() => update({ worldView: 'transmission' })}>查看传导路径<GitBranch size={16} /></button></div>
        </div>
      </section>}
      {view === 'responses' && <section className="world-responses" aria-labelledby="world-responses-title">
        <div className="world-section-heading"><div><p className="world-kicker">RESPONSE LAYER / 应对层</p><h2 id="world-responses-title">把“真假难辨”变成可执行流程</h2><p>按责任主体拆解：先降低高损失场景，再建立可审计的验证链。</p></div><span className="world-muted"><Siren size={15} /> {report.responses?.length ?? 0} 组措施</span></div>
        {!report.responses?.length ? <div className="world-empty" role="status">本期尚未建立应对措施。</div> : <div className="world-response-grid">{report.responses.map((response, index) => <article className="world-response-card" key={response.id}><div className="world-response-number">0{index + 1}</div><div className="world-response-head"><span className="world-kicker">{response.actor}</span><h3>{response.title}</h3></div><p className="world-response-objective">{response.objective}</p><dl><div><dt>触发场景</dt><dd>{response.trigger}</dd></div><div><dt>执行步骤</dt><dd><ol>{response.actions.map((action) => <li key={action}>{action}</li>)}</ol></dd></div><div><dt>局限</dt><dd>{response.limitation}</dd></div><div><dt>验收指标</dt><dd>{response.metric}</dd></div></dl><SourceLinks ids={response.sourceIds} report={report} /></article>)}</div>}
        <div className="world-response-principle"><ShieldCheck size={19} /><div><strong>证据纪律</strong><p>鉴伪分数、标签或水印只能增加线索，不能单独证明内容“真实”。高风险操作至少需要独立回拨、原始凭证、第二责任人和可追溯记录；没有证据就保持待核验状态。</p></div></div>
      </section>}
      {view === 'transmission' && channel && scenario && <section>
        <div className="world-section-heading"><div><p className="world-kicker">FROM EVENTS TO EVERYDAY LIFE</p><h2>变化，怎样传到我们这里？</h2><p>机制示意 · 无未经估计的强度评分</p></div></div>
        <div className="world-segments" aria-label="传导路径">{report.channels.map((item) => <button key={item.id} aria-pressed={channel.id === item.id} onClick={() => update({ channel: item.id })}>{item.title}</button>)}</div>
        <section className="world-channel"><h3>{channel.title}</h3><ol>{channel.stages.map((stage, index) => <li key={stage.label}><span>0{index + 1}</span><div><strong>{stage.label}</strong><p>{stage.detail}</p></div>{index < channel.stages.length - 1 && <ArrowRight size={20} className="world-flow-arrow" />}</li>)}</ol><div className="world-feedback"><GitBranch size={18} /><p><strong>反馈与缓冲</strong>{channel.feedback}</p></div><p className="world-caption">{channel.caveat} <SourceLinks ids={channel.sourceIds} report={report} /></p></section>
        <div className="world-section-heading"><div><p className="world-kicker">CONDITIONAL SCENARIOS</p><h2>三种情景，先问条件</h2><p>编辑条件推演，未赋予概率，不是机构预测。</p></div></div>
        <div className="world-scenario-tabs" aria-label="情景选择">{report.scenarios.map((item) => <button className={item.id} key={item.id} aria-pressed={scenario.id === item.id} onClick={() => update({ scenario: item.id })}>{item.name}{scenario.id === item.id && <Check size={15} />}</button>)}</div>
        <section className={`world-scenario ${scenario.id}`}><p className="world-scenario-premise">{scenario.premise}</p><div className="world-scenario-layout"><div><h3>触发条件</h3><ul>{scenario.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div><div><h3>{report.scenarioAudience?.business ?? '企业经营'}</h3><p>{scenario.business}</p><h3>{report.scenarioAudience?.household ?? '家庭生活'}</h3><p>{scenario.household}</p></div></div><p className="world-invalidation"><strong>什么会推翻这一判断？</strong>{scenario.invalidation}</p></section>
      </section>}
      {view === 'watch' && <section><div className="world-section-heading"><div><p className="world-kicker">OBSERVE, THEN REVISE</p><h2>把判断变成观察清单</h2><p>待跟踪项 · 不代表已接入实时数据</p></div></div><div className="world-watch-list">{report.watchlist.map((item, index) => <article key={item.dimension}><div className="world-watch-number">0{index + 1}</div><div><span className="world-kicker">{item.dimension}</span><h3>{item.indicator}</h3><p>{item.signal}</p><small><Radio size={12} />{item.frequency}</small></div><div><h4>同时排除这些解释</h4><p>{item.alternative}</p><SourceLinks ids={item.sourceIds} report={report} /></div></article>)}</div><div className="world-method-note"><ShieldCheck size={20} /><div><h3>看趋势，也看证据能否推翻自己</h3><p>至少同时观察方向、持续性和覆盖面。不同频率、价格口径与样本范围分别记录；候选指标没有取数时，不用评分或红绿灯代替缺失数据。</p></div></div></section>}
      {view === 'sources' && <section><div className="world-section-heading"><div><p className="world-kicker">EVIDENCE DESK</p><h2>来源、口径与研究方法</h2><p>{report.sources.length} 条来源 · 截止 {report.asOf}</p></div><button className="text-link" onClick={download}><Download size={15} />完整报告</button></div><label className="world-source-search"><Search size={16} /><input aria-label="检索观天下来源" value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="检索机构、标题或支持范围" /></label><div className="world-source-list">{selectedSources.map((source) => <article key={source.id}><div><span>{source.id}</span><span>{source.publisher}</span><time dateTime={source.published.slice(0, source.datePrecision === 'year' ? 4 : source.datePrecision === 'month' ? 7 : 10)}>{worldSourceDate(source)}</time></div><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={15} /></a><p>{source.scope}</p><small>资料所属期间：{source.period}</small></article>)}</div>{!selectedSources.length && <p className="world-empty" role="status">没有匹配来源</p>}
        {method && <details className="world-method"><summary><BookOpen size={17} />栏目说明与选题模板<ChevronRight size={17} /></summary><ContentBody content={method} /></details>}
      </section>}
      <footer className="world-footer"><div><ShieldCheck size={15} /><p>{report.boundary}</p></div><div><TopicPills topics={report.tags} /><span>观天下 / 第 {report.number} 期</span></div><p className="world-caption">影像：NASA Earth Observatory / NOAA，2012年夜光合成；为历史视觉背景，非当前经济热度。<SourceLinks ids={['NASA12']} report={report} /></p></footer>
    </>}
  </section>;
}
