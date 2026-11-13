import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CheckCircle2, ChevronDown, Clock3, Copy, Download, ExternalLink, FileText, RefreshCw, Search, ShieldCheck, TriangleAlert, Upload, Workflow } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from './api';
import type { Content } from './types';
import { briefDate, briefStatusLabels, exportBriefHtml, exportBriefMarkdown, isBriefScheduleOverdue, precisionProjectSummary, precisionSections, searchBriefSources, sourcesForItem } from './precisionBriefModel';
import type { BriefCurrent, BriefItem, BriefRun, BriefRunSummary, BriefSource } from './precisionBriefModel';
import { precisionBriefEditionPayload } from '../../backend/src/precisionBriefSchema';
import './precision-brief.css';

const views = [ ['overview', '项目概览'], ['current', '当前日报'], ['tasks', '五类调研任务'], ['sources', '来源与证据'], ['runs', '运行记录'], ['rules', '规则与来源配置'] ] as const;
type View = typeof views[number][0];
const messageOf = (reason: unknown) => reason instanceof Error ? reason.message : '请求失败，请稍后重试';
const sourceKinds: Record<string, string> = { official: '官方原文', paper: '论文与研究', media: '媒体报道' };
const emptyCurrent: BriefCurrent = { run: null, lastAttempt: null, canManage: false, canInspect: false };

function saveFile(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PrecisionBriefSpace({ project, onBack }: { project: Content; onBack: () => void }) {
  const [params, setParams] = useSearchParams();
  const viewParam = params.get('briefView') ?? 'overview';
  const view = views.find(([key]) => key === viewParam)?.[0];
  const [current, setCurrent] = useState<BriefCurrent>(emptyCurrent);
  const [runs, setRuns] = useState<BriefRunSummary[]>([]);
  const [detail, setDetail] = useState<BriefRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [publishInput, setPublishInput] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const requestedRun = params.get('briefRun');
  const inspectionId = requestedRun ?? (view === 'tasks' && current.canInspect && current.lastAttempt ? String(current.lastAttempt.id) : null);
  const run = inspectionId ? detail?.id === Number(inspectionId) ? detail : null : current.run;
  const mayInspect = current.canInspect;
  const protectedView = view === 'tasks' || view === 'runs' || view === 'rules';
  const documents = (project.children ?? []).filter(item => item.type === 'text').sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const response = await api<BriefCurrent>(`/precision-brief/projects/${project.id}/current`);
    setCurrent(response);
    if (response.canInspect) {
      const history = await api<{ runs: BriefRunSummary[] }>(`/precision-brief/projects/${project.id}/runs`);
      setRuns(history.runs);
    } else setRuns([]);
    return response;
  }, [project.id]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api<BriefCurrent>(`/precision-brief/projects/${project.id}/current`).then(async response => {
      if (!active) return;
      setCurrent(response);
      if (response.canInspect) {
        const history = await api<{ runs: BriefRunSummary[] }>(`/precision-brief/projects/${project.id}/runs`);
        if (active) setRuns(history.runs);
      }
    }).catch(reason => { if (active) setError(messageOf(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project.id]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    if (!inspectionId || !current.canInspect) return;
    if (!/^[1-9]\d*$/.test(inspectionId)) { setError('运行记录编号无效。'); return; }
    setBusy(true); setError('');
    api<BriefRun>(`/precision-brief/runs/${inspectionId}`).then(result => {
      if (!active) return;
      if (result.projectId !== project.id) { setError('未找到本项目的运行记录。'); return; }
      setDetail(result);
    }).catch(reason => { if (active) setError(messageOf(reason)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [inspectionId, current.canInspect, project.id]);
  function navigate(next: View, runId?: number) {
    const query = new URLSearchParams({ project: String(project.id), briefView: next });
    if (runId) query.set('briefRun', String(runId));
    setError(''); setNotice(''); setQuery(''); setParams(query);
  }
  async function reload() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await load();
      if (inspectionId && current.canInspect) {
        const result = await api<BriefRun>(`/precision-brief/runs/${inspectionId}`);
        if (result.projectId === project.id) setDetail(result);
      }
    } catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  }
  async function retry(id: number) {
    if (busy || !current.canManage) return;
    setBusy(true); setError('');
    try {
      await api<BriefRun>(`/precision-brief/runs/${id}/retry`, { method: 'POST', body: '{}' });
      await load(); setNotice('已加入重跑队列，下次 Codex 调度领取；当前日报保持不变。');
    } catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  }
  async function publish() {
    if (!current.canManage || busy) return;
    setBusy(true); setError('');
    try {
      const input = JSON.parse(publishInput) as Record<string, unknown>;
      const published = await api<BriefRun>(`/precision-brief/projects/${project.id}/publish`, { method: 'POST', body: JSON.stringify(input) });
      if (!published.isCurrent || JSON.stringify(precisionBriefEditionPayload(published)) !== JSON.stringify(precisionBriefEditionPayload(input))) {
        throw new Error('发布结果与提交内容不一致，输入已保留，请检查后重试。');
      }
      await load(); setPublishOpen(false); setPublishInput(''); navigate('current'); setNotice('质检通过，当前日报已更新。');
    } catch (reason) { setError(reason instanceof SyntaxError ? 'JSON 格式无效，请检查后再提交。' : messageOf(reason)); } finally { setBusy(false); }
  }
  async function rollback(id: number) {
    if (!current.canManage || busy || !window.confirm('将这份已发布日报设为当前版？运行记录会保留。')) return;
    setBusy(true); setError('');
    try {
      await api(`/precision-brief/runs/${id}/rollback`, { method: 'POST', body: '{}' });
      await load(); setNotice('当前版已切换，历史运行记录保留。');
    } catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  }
  function download(format: 'md' | 'html') {
    if (!run) return;
    saveFile(format === 'md' ? exportBriefMarkdown(run) : exportBriefHtml(run), `PM-行业简报-${run.issueDate}.${format}`, format === 'md' ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8');
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('已复制。'); } catch { setError('无法写入剪贴板，请在下方选择内容复制。'); }
  }
  const latestFailed = current.lastAttempt?.status === 'failed';
  const scheduleEnabled = current.schedule?.enabled === true;
  const scheduleOverdue = scheduleEnabled && isBriefScheduleOverdue(current.lastAttempt, now);
  const sources = run?.sources ?? [];
  const filteredSources = searchBriefSources(sources, query);

  return <section className="precision-space" data-view={view} aria-labelledby="precision-title">
    <div className="precision-toolbar"><button className="precision-link" onClick={onBack}><ArrowLeft size={15} />空间概览</button><button className="precision-icon" aria-label="刷新日报" title="刷新日报" disabled={busy} onClick={() => void reload()}><RefreshCw size={17} /></button></div>
    <header className="precision-header"><span className="precision-eyebrow">事业工作 · 精准医疗</span><h1 id="precision-title">{project.title}</h1><div className="precision-metadata"><span><Clock3 size={14} />{loading ? '正在读取调度状态' : error ? '调度状态暂不可用' : scheduleEnabled ? '每天 09:00 已配置 · 北京时间' : '计划每天 09:00 · 待配置'}</span><span>创建 {briefDate(project.createdAt)}</span><span>更新 {briefDate(project.updatedAt)}</span></div></header>
    <nav className="precision-nav" aria-label="精准医疗简报导航">{views.filter(([key]) => mayInspect || !['tasks', 'runs', 'rules'].includes(key)).map(([key, label]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav>
    {error && <div className="precision-alert" role="alert"><TriangleAlert size={18} /><div>{error}<button className="precision-link" disabled={busy} onClick={() => void reload()}><RefreshCw size={14} />重试读取</button></div></div>}
    {notice && <p className="precision-notice" role="status"><CheckCircle2 size={17} />{notice}</p>}
    {loading ? <p className="precision-empty" role="status">正在读取行业简报…</p> : !view ? <div className="precision-empty"><h2>未找到该视图</h2><button onClick={() => navigate('overview')}>返回项目概览</button></div> : protectedView && !mayInspect || requestedRun && !mayInspect ? <div className="precision-empty"><ShieldCheck size={26} /><h2>此内容仅供项目编辑查看</h2><button onClick={() => navigate('current')}>查看当前日报</button></div> : <>
      {latestFailed && <div className="precision-warning" role="status"><TriangleAlert size={19} /><div><strong>最近一次更新未完成，当前保留上一份成功日报。</strong><p>{briefDate(current.lastAttempt?.updatedAt, true)} · {current.lastAttempt?.errorMessage || '请稍后查看运行状态。'}</p>{current.canManage && current.lastAttempt && <button disabled={busy} onClick={() => void retry(current.lastAttempt!.id)}><RefreshCw size={14} />重新调度</button>}</div></div>}
      {scheduleOverdue && <div className="precision-warning precision-schedule-notice" role="status"><Clock3 size={19} /><div><strong>{current.run ? `当前显示 ${briefDate(current.run.issueDate)} 已发布日报。` : '今日时窗尚无已发布日报。'}</strong><p>今日 09:00 截止的每日时窗仍待更新。</p></div></div>}
      {view === 'overview' && <>
        <section className="precision-intro"><div><p className="precision-eyebrow">PM · PRECISION MEDICINE</p><h2>消息、关注点与业务点评</h2><p>{precisionProjectSummary(project) || '关注肿瘤NGS、MRD、IVD、早筛、液体活检、多组学与医疗AI的新进展。'}</p><button onClick={() => navigate('current')}><FileText size={16} />阅读当前日报<ArrowUpRight size={15} /></button></div><dl><div><dt>当前版本</dt><dd>{current.run ? briefDate(current.run.issueDate) : '尚未发布'}</dd></div><div><dt>资料窗口</dt><dd>{current.run?.firstIssue ? '首期回看 · 7天' : '前24小时'}</dd></div><div><dt>最近一次运行</dt><dd>{current.lastAttempt ? briefStatusLabels[current.lastAttempt.status] ?? current.lastAttempt.status : '尚未运行'}</dd></div></dl></section>
        <section className="precision-topic-list"><h2>五个观察方向</h2>{precisionSections.map(section => <button key={section.key} onClick={() => { navigate('current'); setTimeout(() => document.getElementById(`precision-${section.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }}><span>{section.short}</span><strong>{section.title}</strong><small>{section.scope}</small><ArrowUpRight size={16} /></button>)}</section>
        <footer className="precision-method"><ShieldCheck size={20} /><p>事实、关注点与点评分别呈现。官方原文优先，媒体补充线索；没有经核实的新进展时保留空栏说明。</p></footer>
      </>}
      {view === 'current' && <>
        {requestedRun && <p className="precision-warning">当前查看运行记录 #{requestedRun}，不代表正在展示的最新日报。<button className="precision-link" onClick={() => navigate('current')}>返回当前版</button></p>}
        {!run ? <div className="precision-empty" role="status"><FileText size={28} /><h2>{error ? '暂时无法确认日报状态' : requestedRun ? busy ? '正在读取运行记录…' : '未找到该运行的内容' : '首份日报尚未发布'}</h2><p>{error ? '请重试读取以确认当前版本。' : '完成来源核验与质检后，日报会出现在这里。'}</p></div> : <>
          <div className="precision-report-heading"><div><span className="precision-eyebrow">PM · 每日行业简报</span><h2>{briefDate(run.issueDate)} 行业简报</h2><p>{run.firstIssue && <strong>首期回看窗口 · </strong>}{briefDate(run.windowStart, true)} — {briefDate(run.windowEnd, true)}</p></div><div className="precision-actions"><button onClick={() => download('md')}><Download size={15} />Markdown</button><button onClick={() => download('html')}><Download size={15} />HTML</button></div></div>
          <section className="precision-summary"><h3>本期要点</h3><ReactMarkdown remarkPlugins={[remarkGfm]}>{run.summary}</ReactMarkdown></section>
          {precisionSections.map(section => <details className="precision-section" open key={`${run.id}-${section.key}`} id={`precision-${section.key}`}><summary><span>{section.short}</span><h3>{section.title}</h3><ChevronDown size={18} /></summary>{run.items.filter(item => item.section === section.key).length ? run.items.filter(item => item.section === section.key).map(item => <NewsItem key={item.id} item={item} sources={sources} />) : <p className="precision-no-news">本时窗未发现经核实新增。</p>}</details>)}
          <p className="precision-muted">发布时间：{briefDate(run.publishedAt, true)} · 业务点评为基于公开资料的观察，适用范围以原文为准。</p>
        </>}
      </>}
      {view === 'tasks' && <section className="precision-tasks"><div className="precision-section-heading"><h2>五类调研任务</h2>{current.canManage && (current.lastAttempt || current.run) && <button disabled={busy} onClick={() => void retry((current.lastAttempt ?? current.run)!.id)}><RefreshCw size={15} />重新调度</button>}</div><p className="precision-muted">{run ? `${briefDate(run.issueDate)} · 运行 #${run.id}` : '当前尚无任务记录。'}</p>{precisionSections.map(section => {
        const task = run?.tasks.find(item => item.kind === section.key);
        return <details className="precision-task" key={`${run?.id}-${section.key}`}><summary><span>{section.short}</span><div><h3>{section.title}</h3><p>{section.scope}</p></div><span className={`precision-status ${task?.status === 'failed' ? 'failed' : ''}`}>{task ? briefStatusLabels[task.status] ?? task.status : '尚未运行'}</span><ChevronDown size={16} /></summary>{task ? <div className="precision-task-body"><p className="precision-muted">开始 {briefDate(task.startedAt, true)} · 完成 {briefDate(task.completedAt, true)}</p>{task.coverage && <p><strong>检索覆盖：</strong>{task.coverage}</p>}{task.errorMessage && <p role="alert" className="precision-warning">{task.errorMessage}</p>}<ReactMarkdown remarkPlugins={[remarkGfm]}>{task.rawReport || '本任务尚未返回调研结果。'}</ReactMarkdown></div> : <p className="precision-empty">暂无调研结果。</p>}</details>;
      })}</section>}
      {view === 'sources' && <section><div className="precision-section-heading"><h2>来源与证据</h2><label className="precision-search"><Search size={16} /><input aria-label="检索日报来源" placeholder="标题、机构或来源类型" value={query} onChange={event => setQuery(event.target.value)} /></label></div><p className="precision-muted">对应{run ? briefDate(run.issueDate) : '当前'}日报；来源核验仅支持其记载的事实，点评与事实分开。</p>{filteredSources.map(source => <SourceEntry key={source.id} source={source} items={run?.items.filter(item => item.sourceIds.includes(source.key)) ?? []} />)}{!filteredSources.length && <p className="precision-empty">{query ? '没有匹配的来源。' : '暂无已发布来源。'}</p>}</section>}
      {view === 'runs' && <section>
        <div className="precision-section-heading"><h2>运行记录</h2>{current.canManage && <button onClick={() => setPublishOpen(!publishOpen)}><Upload size={15} />提交生成结果</button>}</div>
        {publishOpen && <form className="precision-publish" onSubmit={event => { event.preventDefault(); void publish(); }}><label>已生成的结构化日报<textarea aria-label="结构化日报JSON" spellCheck={false} rows={10} value={publishInput} onChange={event => setPublishInput(event.target.value)} required /></label><p className="precision-muted">提交后重新执行服务端质检；失败时保留当前版。</p><button type="submit" disabled={busy || !publishInput.trim()}><ShieldCheck size={15} />校验并发布</button></form>}
        {runs.length ? <div className="precision-runs">{runs.map(record => <article key={record.id}>
          <div><strong>{briefDate(record.issueDate)} <small>#{record.id}</small></strong><span className={`precision-status ${record.status === 'failed' ? 'failed' : ''}`}>{briefStatusLabels[record.status] ?? record.status}</span>{record.isCurrent && <span className="precision-status">当前版</span>}</div>
          <p>{briefDate(record.windowStart, true)} — {briefDate(record.windowEnd, true)}</p>{record.errorMessage && <p className="precision-run-error">{record.errorMessage}</p>}
          <div className="precision-actions"><button onClick={() => navigate('tasks', record.id)}><Workflow size={14} />任务记录</button><button onClick={() => navigate('current', record.id)}><FileText size={14} />查看内容</button>{current.canManage && record.status !== 'running' && <button disabled={busy} onClick={() => void retry(record.id)}><RefreshCw size={14} />重新调度</button>}{current.canManage && record.status === 'published' && !record.isCurrent && <button disabled={busy} onClick={() => void rollback(record.id)}><CheckCircle2 size={14} />设为当前版</button>}</div>
        </article>)}</div> : <p className="precision-empty">暂无运行记录。</p>}
      </section>}
      {view === 'rules' && <section className="precision-rules"><h2>规则与来源配置</h2><dl className="precision-facts"><div><dt>调度配置</dt><dd>{scheduleEnabled ? `已配置 · 每天 09:00 · ${current.schedule!.timezone}` : '未配置 · 计划每天 09:00 · Asia/Shanghai'}{current.schedule?.configuredAt && <small>配置于 {briefDate(current.schedule.configuredAt, true)}</small>}</dd></div><div><dt>运行环境</dt><dd>本地电脑及 Codex 应用需保持可用；调度已配置不代表当日任务已经执行。</dd></div><div><dt>最近一次运行</dt><dd>{current.lastAttempt ? <>{briefStatusLabels[current.lastAttempt.status] ?? current.lastAttempt.status} · {briefDate(current.lastAttempt.updatedAt, true)}<small>数据截止 {briefDate(current.lastAttempt.windowEnd, true)}</small></> : '尚无运行记录'}</dd></div><div><dt>发布策略</dt><dd>全部质检通过后自动发布，失败保留上一版。</dd></div><div><dt>资料窗口</dt><dd>日常前24小时；首期回看7天并明确标注。</dd></div><div><dt>单条密度</dt><dd>消息、关注点和点评合计不超过300字，每栏最多3条。</dd></div></dl>{documents.length ? documents.map(doc => <details key={doc.id} className="precision-rule-doc"><summary><FileText size={16} />{doc.title}<ChevronDown size={16} /></summary><div className="precision-markdown"><button className="precision-icon precision-copy" title="复制文档" aria-label={`复制${doc.title}`} onClick={() => void copy(doc.description)}><Copy size={15} /></button><ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.description}</ReactMarkdown></div></details>) : <div className="precision-markdown"><h3>采集与发布要求</h3><p>五个专题独立调研。企业公告、监管原文、临床研究和财报优先；媒体报道需标注来源等级，关键事实回溯原文。</p><p>原始事实必须可核对，每条包含来源、关注点与业务点评。没有新增时明确说明检索覆盖，不用旧闻凑数。</p></div>}</section>}
    </>}
  </section>;
}

function NewsItem({ item, sources }: { item: BriefItem; sources: BriefSource[] }) {
  return <article className={`precision-news${item.severity === 'important' ? ' important' : ''}`}><h4>{item.severity === 'important' && <TriangleAlert size={19} aria-label="重大或超预期" />}{item.title}</h4><dl><div><dt>消息</dt><dd>{item.message}</dd></div><div><dt>关注点</dt><dd>{item.attention}</dd></div><div><dt>点评</dt><dd>{item.commentary}</dd></div></dl><div className="precision-citations">{sourcesForItem(item, sources).map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.publisher}</span><span>发布 {briefDate(source.publishedAt)} · 访问 {briefDate(source.accessedAt)}</span><ExternalLink size={13} /></a>)}</div></article>;
}
function SourceEntry({ source, items }: { source: BriefSource; items: BriefItem[] }) {
  return <article className="precision-source"><div><span className="precision-status">{sourceKinds[source.sourceType] ?? source.sourceType}</span><span>{source.verified ? <><CheckCircle2 size={14} />原文已核对</> : <><Clock3 size={14} />待核验</>}</span></div><h3><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={14} /></a></h3><p>{source.publisher} · 发布 {briefDate(source.publishedAt)} · 访问 {briefDate(source.accessedAt)}</p><ul>{items.map(item => <li key={item.id}>{item.title}</li>)}</ul></article>;
}
