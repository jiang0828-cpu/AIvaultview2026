import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, ChevronRight, Download, ExternalLink, FileSpreadsheet, FlaskConical, GitBranch, Layers3, RefreshCw, Search, ShieldAlert, Target } from 'lucide-react';
import type { Content } from './types';
import { isProject } from './projectNavigation';
import './mrna-research.css';

type SourceRef = { sourceIds: string[] };
type ResearchSource = { id: string; title: string; publisher: string; date: string; url: string; kind: string; locator: string; accessLevel: string; accessedDate: string };
type Evidence = SourceRef & { id: string; program: string; trial: string; phase: string; population: string; analysisSet: string; endpoint: string; result: string; interpretation: string; sentiment: 'positive' | 'negative' | 'mixed'; n: string; dataCutoff: string; followUp: string; design: string; regimen: string; control: string; safety: string };
type ResearchTrial = SourceRef & { id: string; program: string; sponsor: string; route: string; indication: string; phase: string; countries: string[]; status: string; registryUpdatedAt: string; plannedEnrollment: number | null; actualEnrollment: number | null; primaryCompletion: string; registryUrl: string; notes: string; scope: string; exclusionReason: string };
export type MrnaResearchData = {
  updatedAt: string; asOf: string; title?: string; summary: string;
  highlights: (SourceRef & { title: string; detail: string; tag: string })[];
  timeline: (SourceRef & { date: string; title: string; detail: string; category: string })[];
  evidence: Evidence[]; trials: ResearchTrial[];
  technology: (SourceRef & { title: string; detail: string; implication: string })[];
  bd: (SourceRef & { id: string; target: string; need: string; entry: string; evidence: string; validation: string; next: string })[];
  sources: ResearchSource[];
  deliverables: { title: string; description: string; url: string; format: string }[];
  limitations: string[]; chartSourceIds?: string[];
  chart?: { rfs: { label: string; hr: number; low: number; high: number }[]; safety: { label: string; value: number }[]; followUp: string | number; n: string | number; safetyContext?:string };
};

const tabs = [
  { key: 'overview', label: '研究概览', Icon: Activity },
  { key: 'evidence', label: '临床证据', Icon: FlaskConical },
  { key: 'pipeline', label: '管线台账', Icon: GitBranch },
  { key: 'technology', label: '技术与BD', Icon: Target },
  { key: 'sources', label: '来源交付', Icon: BookOpen },
];
const sentimentLabels = { positive: '正向信号', negative: '未达预期 / 终止', mixed: '审慎解读' };
const scopeLabels: Record<string, string> = { core: '核心扩展范围', adjacent: '相邻技术', excluded: '相邻排除', '相邻/排除': '相邻排除' };
const displayValue = (value: unknown) => typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? String(value) : '未披露';
const scopeLabel = (scope: string) => scopeLabels[scope] || scope || '范围未标明';

export function isMrnaProject(project: Content) {
  return isProject(project) && /mrna/i.test(project.title);
}

function SourceLinks({ ids, sources }: { ids?: string[]; sources: ResearchSource[] }) {
  const resolved = (ids || []).map((id) => sources.find((source) => source.id === id)).filter((source): source is ResearchSource => !!source);
  return <span className="mrna-source-links">{resolved.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{source.id}<ArrowUpRight size={10} /></a>)}</span>;
}

function EvidenceCharts({ data }: { data: MrnaResearchData }) {
  if (!data.chart?.rfs.length) return null;
  const { rfs, safety, followUp, n } = data.chart;
  const plotX = (value: number) => 54 + value * 180;
  return <div className="mrna-charts">
    <section className="mrna-chart-panel">
      <div className="mrna-section-head"><div><span className="mrna-eyebrow">V940 · III期 · RFS</span><h3>同一试验，不同分析集</h3></div><span className="mrna-chip">HR · 95% CI</span></div>
      <p className="mrna-chart-context">{followUp} · {n}</p>
      <div className="mrna-forest" role="img" aria-label={rfs.map((row) => `${row.label}：HR ${row.hr}，95% CI ${row.low}至${row.high}`).join('；')}>
        <svg viewBox={`0 0 380 ${rfs.length * 61 + 50}`} aria-hidden="true">
          <line x1={plotX(1)} x2={plotX(1)} y1="5" y2={rfs.length * 61 + 5} stroke="#a7aaa5" strokeDasharray="4 4" />
          {rfs.map((row, index) => <g key={row.label} transform={`translate(0 ${index * 61})`}>
            <text x="8" y="17" className="mrna-svg-label">{row.label}</text>
            <line x1={plotX(row.low)} x2={plotX(row.high)} y1="35" y2="35" stroke={index === 0 ? '#177568' : '#646aae'} strokeWidth="3" />
            <line x1={plotX(row.low)} x2={plotX(row.low)} y1="29" y2="41" stroke="#177568" /><line x1={plotX(row.high)} x2={plotX(row.high)} y1="29" y2="41" stroke="#177568" />
            <rect x={plotX(row.hr) - 5} y="30" width="10" height="10" fill={index === 0 ? '#177568' : '#646aae'} />
            <text x="375" y="39" textAnchor="end" className="mrna-svg-value">{row.hr.toFixed(2)} ({row.low.toFixed(2)}–{row.high.toFixed(2)})</text>
          </g>)}
          {[0, 0.5, 1].map((tick) => <text key={tick} x={plotX(tick)} y={rfs.length * 61 + 24} textAnchor="middle" className="mrna-svg-axis">{tick.toFixed(1)}</text>)}
          <line x1={plotX(0)} x2={plotX(1)} y1={rfs.length * 61 + 8} y2={rfs.length * 61 + 8} stroke="#d5dfd8" />
        </svg>
      </div>
      <p className="mrna-chart-note">ITT 与 mITT 来自同一试验；mITT限至少接受一剂计划内V940/安慰剂的人群，不能替代ITT。<SourceLinks ids={data.chartSourceIds} sources={data.sources} /></p>
    </section>
    <section className="mrna-chart-panel">
      <div className="mrna-section-head"><div><span className="mrna-eyebrow">V940 · 安全性</span><h3>≥3级治疗相关不良事件</h3></div><span className="mrna-chip">TRAE</span></div>
      <div className="mrna-safety">{safety.map((row, index) => <div className="mrna-safety-row" key={row.label}><div><span>{row.label}</span><strong>{row.value.toFixed(1)}<small>%</small></strong></div><div className="mrna-bar-track"><span style={{ width: `${Math.min(row.value / 20 * 100, 100)}%`, background: index === 0 ? '#177568' : '#777cb0' }} /></div></div>)}</div>
      <div className="mrna-safety-axis"><span>0</span><span>10%</span><span>20%</span></div>
      <p className="mrna-chart-note">{data.chart?.safetyContext}。按公开披露的分组发生率展示，不能替代完整安全性分析。<SourceLinks ids={data.chartSourceIds} sources={data.sources} /></p>
    </section>
  </div>;
}

function EvidenceItem({ item, sources }: { item: Evidence; sources: ResearchSource[] }) {
  return <article className={`mrna-evidence-item ${item.sentiment}`}>
    <div className="mrna-evidence-heading"><div><span className="mrna-eyebrow">{item.phase || '分期未标明'} · {item.trial}</span><h3>{item.program}</h3></div><span className={`mrna-status ${item.sentiment}`}>{sentimentLabels[item.sentiment] || '审慎解读'}</span></div>
    <p className="mrna-evidence-population">{displayValue(item.population)} · {displayValue(item.analysisSet)}</p>
    <div className="mrna-evidence-result"><span>{item.endpoint || '尚无结果分析'}</span><strong>{item.result || '本次更新未披露临床结果；不将计划入组当作已完成治疗。'}</strong></div>
    <dl className="mrna-evidence-facts">{([
      ['样本量', item.n], ['数据截点', item.dataCutoff], ['随访', item.followUp], ['试验设计', item.design], ['试验方案', item.regimen], ['对照方案', item.control], ['安全性', item.safety],
    ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl>
    <p>{item.interpretation}</p><SourceLinks ids={item.sourceIds} sources={sources} />
  </article>;
}

function Pipeline({ trials, sources }: { trials: ResearchTrial[]; sources: ResearchSource[] }) {
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const options = useMemo(() => ({ routes: Array.from(new Set(trials.map((item) => item.route))).filter(Boolean).sort(), countries: Array.from(new Set(trials.flatMap((item) => item.countries))).sort(), statuses: Array.from(new Set(trials.map((item) => item.status))).filter(Boolean).sort() }), [trials]);
  const filtered = trials.filter((item) => (!route || item.route === route) && (!country || item.countries.includes(country)) && (!status || item.status === status) && (!scope || scopeLabel(item.scope) === scope) && `${item.id} ${item.program} ${item.sponsor} ${item.indication}`.toLowerCase().includes(query.toLowerCase()));
  const selected = filtered.find((item) => item.id === selectedId);
  return <section className="mrna-section">
    <div className="mrna-section-head"><div><span className="mrna-eyebrow">CLINICAL TRIAL REGISTER</span><h2>管线台账</h2></div><span className="mrna-muted">{filtered.length} / {trials.length} 条注册快照（含相邻）</span></div>
    <div className="mrna-scope-filter" role="group" aria-label="筛选研究范围">{['', '核心扩展范围', '相邻技术', '相邻排除'].map((value) => <button key={value} aria-pressed={scope === value} className={scope === value ? 'active' : ''} onClick={() => setScope(value)}>{value || '全部范围'}</button>)}</div>
    <div className="mrna-filters"><label className="mrna-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="项目、申办方、适应证或 NCT 编号" aria-label="检索临床试验" /></label><select aria-label="筛选技术路线" value={route} onChange={(event) => setRoute(event.target.value)}><option value="">全部技术路线</option>{options.routes.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="筛选国家" value={country} onChange={(event) => setCountry(event.target.value)}><option value="">全部国家</option>{options.countries.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="筛选状态" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option>{options.statuses.map((value) => <option key={value}>{value}</option>)}</select>{(query || route || country || status || scope) && <button className="mrna-reset" title="重置筛选" aria-label="重置筛选" onClick={() => { setQuery(''); setRoute(''); setCountry(''); setStatus(''); setScope(''); setSelectedId(null); }}><RefreshCw size={16} /></button>}</div>
    <div className="mrna-table-wrap"><table className="mrna-table"><thead><tr><th>项目 / 注册号</th><th>范围</th><th>路线 / 适应证</th><th>分期 / 状态</th><th>国家 / 地区</th><th>计划样本</th><th>实际入组</th><th>注册更新日</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className={selectedId === item.id ? 'selected' : ''}><td><button className="mrna-trial-link" onClick={() => setSelectedId(selectedId === item.id ? null : item.id)} aria-expanded={selectedId === item.id}><strong>{item.program}</strong><span>{item.id}<ChevronRight size={13} /></span></button><small>{item.sponsor}</small></td><td><span className={`mrna-scope-badge ${scopeLabel(item.scope) === '相邻排除' ? 'excluded' : scopeLabel(item.scope) === '相邻技术' ? 'adjacent' : ''}`}>{scopeLabel(item.scope)}</span>{item.exclusionReason && <small>{item.exclusionReason}</small>}</td><td>{item.route}<small>{item.indication}</small></td><td>{item.phase || '未标明'}<small className="mrna-trial-status">{item.status}</small></td><td>{item.countries.length ? item.countries.join('、') : '未披露'}</td><td className="mrna-number">{item.plannedEnrollment?.toLocaleString() ?? '未披露'}</td><td className="mrna-number">{item.actualEnrollment?.toLocaleString() ?? '未披露'}</td><td className="mrna-date">{item.registryUpdatedAt || '未披露'}</td></tr>)}</tbody></table>{!filtered.length && <div className="mrna-empty">未找到符合条件的注册记录。请调整筛选条件。</div>}</div>
    {selected && <aside className="mrna-trial-detail"><div className="mrna-section-head"><h3>{selected.program} · {selected.id}</h3><a href={selected.registryUrl} target="_blank" rel="noreferrer">注册原文<ExternalLink size={14} /></a></div><p><span className="mrna-scope-badge">{scopeLabel(selected.scope)}</span> {selected.exclusionReason}</p><p>{selected.notes}</p><p className="mrna-muted">主要完成日期：{selected.primaryCompletion || '未披露'}<SourceLinks ids={selected.sourceIds} sources={sources} /></p></aside>}
    <p className="mrna-chart-note">计划样本与实际入组按注册字段分别保留，未披露不记为 0。注册更新日与结果披露日不同。本台账包含相邻技术、观察性记录与癌前病变研究，不将其统称肿瘤治疗试验；本次样本不代表全球管线总量。</p>
  </section>;
}

export function MrnaResearchSpace({ project, onBack }: { project: Content; onBack: () => void }) {
  const [params, setParams] = useSearchParams();
  const view = tabs.some((tab) => tab.key === params.get('view')) ? params.get('view')! : 'overview';
  const [data, setData] = useState<MrnaResearchData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    void fetch('/media/projects/mrna/research-data.json', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`研究资料载入失败 (${response.status})`);
      const result = await response.json() as MrnaResearchData;
      if (!Array.isArray(result.trials) || !Array.isArray(result.sources) || !Array.isArray(result.evidence)) throw new Error('研究资料格式不完整');
      if (!controller.signal.aborted) setData(result);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '研究资料载入失败'); });
    return () => controller.abort();
  }, [project.id, retry]);
  const navigate = (next: string) => setParams({ project: String(project.id), view: next });
  const negativeEvidence = data?.evidence.filter((item) => item.sentiment === 'negative') || [];
  return <section className="mrna-space" aria-labelledby="mrna-title">
    <div className="mrna-topline"><button className="back-link" onClick={onBack}><ArrowLeft size={14} />返回空间概览</button><span><FlaskConical size={14} />生物医药 · 肿瘤药物研究</span></div>
    <header className="mrna-header"><div><span className="mrna-eyebrow">ONCOLOGY RESEARCH DESK</span><h1 id="mrna-title">mRNA 肿瘤药物<span>研究工作台</span></h1><p>{data?.summary || '肿瘤疫苗与蛋白表达 · 临床证据 · 技术与商务拓展'}</p></div><div className="mrna-header-meta"><span className="mrna-update-dot" />资料截至 <strong>{data?.asOf || '载入中'}</strong>{data?.deliverables.find((item) => /xlsx|excel/i.test(item.format)) && <a className="mrna-download" href={data.deliverables.find((item) => /xlsx|excel/i.test(item.format))!.url} download><FileSpreadsheet size={16} />下载研究台账</a>}</div></header>
    <nav className="mrna-tabs" aria-label="mRNA研究导航">{tabs.map(({ key, label, Icon }) => <button key={key} className={view === key ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={16} />{label}</button>)}</nav>
    {error ? <div className="mrna-load-error" role="alert"><ShieldAlert size={23} /><p>{error}</p><button className="button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={15} />重新加载</button></div> : !data ? <div className="mrna-loading" role="status"><Activity size={22} />正在载入研究资料与注册台账…</div> : <>
      {view === 'overview' && <>
        <div className="mrna-metrics"><div><FlaskConical size={18} /><strong>{data.trials.length}</strong><span>注册快照（含相邻）</span></div><div><Layers3 size={18} /><strong>{new Set(data.trials.map((item) => item.route)).size}</strong><span>样本技术路线</span></div><div><BookOpen size={18} /><strong>{data.sources.length}</strong><span>可追溯来源</span></div><div><ShieldAlert size={18} /><strong>{negativeEvidence.length}</strong><span>关键负向证据</span></div></div>
        <div className="mrna-highlights">{data.highlights.map((item) => <article key={item.title}><span className="mrna-chip">{item.tag}</span><h3>{item.title}</h3><p>{item.detail}</p><SourceLinks ids={item.sourceIds} sources={data.sources} /></article>)}</div>
        <EvidenceCharts data={data} />
        {negativeEvidence.length > 0 && <section className="mrna-negative-band"><div className="mrna-section-head"><div><span className="mrna-eyebrow"><ShieldAlert size={14} />负向证据观察</span><h2>结论必须容纳失败</h2></div><button onClick={() => navigate('evidence')}>全部临床证据<ChevronRight size={15} /></button></div><div className="mrna-negative-grid">{negativeEvidence.map((item) => <div key={item.id}><h3>{item.program}<span>{item.trial}</span></h3><strong>{item.result}</strong><p>{item.interpretation}</p><SourceLinks ids={item.sourceIds} sources={data.sources} /></div>)}</div></section>}
        <section className="mrna-section"><div className="mrna-section-head"><div><span className="mrna-eyebrow">LATEST DEVELOPMENTS</span><h2>前沿进展时间线</h2></div><span className="mrna-muted">按公开披露日期</span></div><ol className="mrna-timeline">{data.timeline.map((item) => <li key={`${item.date}-${item.title}`}><time>{item.date}</time><div><span className="mrna-chip">{item.category}</span><h3>{item.title}</h3><p>{item.detail}</p><SourceLinks ids={item.sourceIds} sources={data.sources} /></div></li>)}</ol></section>
      </>}
      {view === 'evidence' && <section className="mrna-section"><div className="mrna-section-head"><div><span className="mrna-eyebrow">EVIDENCE & UNCERTAINTY</span><h2>临床证据</h2></div><span className="mrna-muted">分析集、终点与局限分别保留</span></div><EvidenceCharts data={data} /><div className="mrna-evidence-grid">{[...data.evidence].sort((a, b) => Number(b.sentiment === 'negative') - Number(a.sentiment === 'negative')).map((item) => <EvidenceItem key={item.id} item={item} sources={data.sources} />)}</div></section>}
      {view === 'pipeline' && <Pipeline trials={data.trials} sources={data.sources} />}
      {view === 'technology' && <><section className="mrna-section"><div className="mrna-section-head"><div><span className="mrna-eyebrow">PLATFORM & TRANSLATION</span><h2>技术路线与转化约束</h2></div></div><div className="mrna-technology-grid">{data.technology.map((item, index) => <article key={item.title}><span className="mrna-tech-index">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.detail}</p><div className="mrna-implication"><strong>研究判断</strong><p>{item.implication}</p></div><SourceLinks ids={item.sourceIds} sources={data.sources} /></article>)}</div></section><section className="mrna-section"><div className="mrna-section-head"><div><span className="mrna-eyebrow">BUSINESS DEVELOPMENT</span><h2>BD切入与验证</h2></div><span className="mrna-muted">研究假设 · 非已确认交易</span></div><div className="mrna-bd-list">{(data.bd || []).map((item) => <article key={item.id}><div><span className="mrna-eyebrow">{item.id}</span><h3>{item.target}</h3><SourceLinks ids={item.sourceIds} sources={data.sources} /></div><dl><div><dt>需求</dt><dd>{item.need}</dd></div><div><dt>切入点</dt><dd>{item.entry}</dd></div><div><dt>证据</dt><dd>{item.evidence}</dd></div><div><dt>待验证</dt><dd>{item.validation}</dd></div><div><dt>下一步</dt><dd>{item.next}</dd></div></dl></article>)}</div></section></>}
      {view === 'sources' && <><section className="mrna-section"><div className="mrna-section-head"><div><span className="mrna-eyebrow">RESEARCH DELIVERABLES</span><h2>研究交付</h2></div></div><div className="mrna-deliverables">{data.deliverables.map((item) => <a key={item.url} href={item.url} download><span className="mrna-deliverable-icon">{/xlsx|excel/i.test(item.format) ? <FileSpreadsheet size={25} /> : <BookOpen size={25} />}</span><div><span className="mrna-eyebrow">{item.format}</span><h3>{item.title}</h3><p>{item.description}</p></div><Download size={18} /></a>)}</div></section><section className="mrna-limitations"><h3><ShieldAlert size={18} />研究边界</h3><ul>{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="mrna-section"><div className="mrna-section-head"><div><span className="mrna-eyebrow">SOURCE REGISTER</span><h2>来源登记</h2></div><span className="mrna-muted">{data.sources.length} 条</span></div><div className="mrna-source-register">{data.sources.map((source) => <article key={source.id}><span className="mrna-source-id">{source.id}</span><div><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={13} /></a><p>{source.publisher} · {source.date || '未标注日期'} · {source.kind}</p><dl className="mrna-source-access"><div><dt>定位</dt><dd>{displayValue(source.locator)}</dd></div><div><dt>访问级别</dt><dd>{displayValue(source.accessLevel)}</dd></div><div><dt>实际访问</dt><dd>{displayValue(source.accessedDate)}</dd></div></dl></div></article>)}</div></section></>}
      <footer className="mrna-footer"><span><CheckCircle2 size={13} />证据可回溯 · 研究样本版</span><span>资料截至 {data.asOf} · 更新 {data.updatedAt}</span></footer>
    </>}
  </section>;
}
