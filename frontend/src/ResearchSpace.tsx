import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowUpRight, Archive, Check, ChevronDown, ChevronUp, Copy, Download, FileText, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from './api';
import type { Content } from './types';
import { conclusionLabels, researchCompletion, researchDefinitions, researchPrompt, researchStatusLabels, researchVersionDiff, searchResearchSources, taskInput } from './researchModel';
import type { ResearchStudyView, ResearchTaskView, ResearchTaskInput, ResearchSynthesisView, ResearchVersionView } from './researchModel';
import './research.css';
import { ResearchReport } from './ResearchReport';

const views = [['overview', '项目概览'], ['report', '调研报告'], ['goal', '对象与目标'], ['tasks', '四维任务'], ['synthesis', '综合研判'], ['sources', '来源台账'], ['history', '历史版本']] as const;
type View = typeof views[number][0];
const messageOf = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试';
const request = (method: string, body: unknown = {}) => ({ method, body: JSON.stringify(body) });
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
const synthesisFields = [['executiveSummary', '执行摘要'], ['marketOpportunity', '市场规模、机会与增长逻辑'], ['targetUsers', '目标用户与需求'], ['feasibility', '产品与技术可行性'], ['competition', '竞争格局'], ['risks', '关键风险'], ['recommendation', '商业模式、进入路径与决策建议']] as const;
type DirtyProps = { onDirty: (dirty: boolean) => void };

export function ResearchSpace({ project, onBack, onDirtyChange }: { project: Content; onBack: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [params, setParams] = useSearchParams();
  const [studies, setStudies] = useState<ResearchStudyView[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [query, setQuery] = useState('');
  const [editorEpoch, setEditorEpoch] = useState(0);
  const dirty = useRef(false);
  const historyPosition = useRef<{ index: number | undefined; url: string }>({ index: window.history.state?.idx, url: window.location.href });
  const restoringHistory = useRef(false);
  const markDirty = useCallback((value: boolean) => { dirty.current = value; onDirtyChange?.(value); }, [onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  const viewParam = params.get('researchView');
  const view = (viewParam || 'overview') as View;
  const validView = views.some(([key]) => key === view);
  const requestedStudy = params.get('study');
  const study = requestedStudy ? studies.find(item => String(item.id) === requestedStudy) : studies[0];
  const requestedTask = params.get('task');
  const task = study?.tasks.find(item => String(item.id) === requestedTask);
  const canEdit = Boolean(study?.canEdit && study.status !== 'archived');
  const completion = researchCompletion(study?.tasks ?? []);
  useEffect(() => { historyPosition.current = { index: window.history.state?.idx, url: window.location.href }; }, [params]);
  const load = useCallback(async () => {
    const [rows, access] = await Promise.all([api<ResearchStudyView[]>(`/research/studies/${project.id}`), api<{ canEdit: boolean }>(`/research/projects/${project.id}/access`)]);
    setStudies(rows); setCanCreate(access.canEdit);
  }, [project.id]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([api<ResearchStudyView[]>(`/research/studies/${project.id}`), api<{ canEdit: boolean }>(`/research/projects/${project.id}/access`)])
      .then(([rows, access]) => { if (active) { setStudies(rows); setCanCreate(access.canEdit); } })
      .catch(reason => { if (active) setError(messageOf(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project.id]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } }
    function linkNavigation(event: MouseEvent) {
      const control = (event.target as HTMLElement).closest('a, button');
      if (!control || !dirty.current) return;
      if (control instanceof HTMLAnchorElement && control.target === '_blank') return;
      if (control.closest('.research-space') && !(control instanceof HTMLAnchorElement)) return;
      if (!window.confirm('有未保存的修改，确认离开并放弃这些修改？')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    function historyNavigation(event: PopStateEvent) {
      if (restoringHistory.current) { restoringHistory.current = false; event.stopImmediatePropagation(); return; }
      if (!dirty.current) return;
      if (window.confirm('有未保存的修改，确认离开并放弃这些修改？')) { dirty.current = false; onDirtyChange?.(false); return; }
      event.stopImmediatePropagation();
      const previous = historyPosition.current;
      const nextIndex = event.state?.idx;
      if (typeof previous.index === 'number' && typeof nextIndex === 'number' && previous.index !== nextIndex) {
        restoringHistory.current = true;
        window.history.go(previous.index - nextIndex);
      } else {
        window.history.replaceState(window.history.state, '', previous.url);
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', linkNavigation, true);
    window.addEventListener('popstate', historyNavigation, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', linkNavigation, true); window.removeEventListener('popstate', historyNavigation, true); };
  }, [onDirtyChange]);
  function leave() { if (busy) return false; if (dirty.current && !window.confirm('有未保存的修改，确认放弃并切换？')) return false; markDirty(false); setCreating(false); setNewTitle(''); setError(''); setNotice(''); setConflict(false); return true; }
  function navigate(nextView: View, taskId?: number, studyId = study?.id) {
    if (!creating && nextView === view && studyId === study?.id && String(taskId ?? '') === String(requestedTask ?? '') && !params.get('researchHistory')) return;
    const next = new URLSearchParams(params);
    next.set('researchView', nextView);
    next.delete('researchHistory');
    if (studyId) next.set('study', String(studyId)); else next.delete('study');
    if (taskId) next.set('task', String(taskId)); else next.delete('task');
    if (!leave()) return;
    setParams(next);
  }
  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice(''); setConflict(false);
    try { await action(); markDirty(false); await load(); setNotice(success); return true; }
    catch (reason) { setError(messageOf(reason)); setConflict(reason instanceof ApiError && reason.status === 409); return false; }
    finally { setBusy(false); }
  }
  async function reload() {
    if (busy || dirty.current && !window.confirm('有未保存的修改，确认放弃并重新加载？')) return;
    setBusy(true);
    try { await load(); markDirty(false); setCreating(false); setNewTitle(''); setEditorEpoch(value => value + 1); setError(''); setConflict(false); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setLoading(false); setBusy(false); }
  }
  async function createStudy() {
    const title = newTitle.trim(); if (!title || busy) return;
    let created: ResearchStudyView | undefined;
    const ok = await mutate(async () => { created = await api<ResearchStudyView>('/research/studies', request('POST', { projectId: project.id, title, researchObject: '', goal: '' })); }, '研究已建立，请填写对象与目标。');
    if (ok && created) { setCreating(false); setNewTitle(''); navigate('goal', undefined, created.id); }
  }
  async function download() {
    if (!study || busy) return;
    if (dirty.current) { setError('请先保存当前修改，再导出已保存的研究资料。'); return; }
    setBusy(true); setError('');
    try { const result = await api<{ markdown: string; filename: string }>(`/research/studies/${study.id}/export`); const url = URL.createObjectURL(new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click(); URL.revokeObjectURL(url); setNotice('Markdown 已导出。'); } catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  }
  return <section className="research-space" aria-labelledby="research-title">
    <div className="research-toolbar"><button className="back-link" onClick={() => { if (leave()) onBack(); }}><ArrowLeft size={15} />空间概览</button><button className="research-icon" title="重新加载服务端资料" aria-label="重新加载服务端资料" disabled={busy} onClick={() => void reload()}><RefreshCw size={16} /></button></div>
    <header className="research-header"><div><span className="research-eyebrow">事业工作 · 市场调研</span><h1 id="research-title">{project.title}</h1><p>四维独立研究 → 证据汇编 → 人工研判</p></div><span className="research-manual">手动分派</span></header>
    <div className="research-studybar"><label>研究档案<select value={study?.id ?? ''} onChange={event => navigate('overview', undefined, Number(event.target.value))} disabled={busy || loading}>{!studies.length && <option value="">暂无研究</option>}{requestedStudy && !study && <option value="">研究不存在</option>}{studies.map(item => <option key={item.id} value={item.id}>{item.title}{item.status === 'archived' ? '（已归档）' : ''}</option>)}</select></label>{canCreate && <button onClick={() => { if (leave()) setCreating(!creating); }} disabled={busy}><Plus size={15} />新建研究</button>}{study && <span className="research-muted">{study.status === 'archived' ? '已归档 · 只读' : study.canEdit ? '可编辑' : '只读'}</span>}</div>
    {creating && <form className="research-create" onSubmit={event => { event.preventDefault(); void createStudy(); }}><label>研究名称<input required maxLength={160} value={newTitle} onChange={event => { setNewTitle(event.target.value); markDirty(Boolean(event.target.value)); }} /></label><button disabled={busy || !newTitle.trim()} type="submit"><Plus size={15} />建立</button><button type="button" onClick={() => { if (leave()) { setCreating(false); setNewTitle(''); } }}>取消</button></form>}
    <nav className="research-nav" aria-label="市场调研导航">{views.map(([key, label]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav>
    {error && <div className="research-error" role="alert">{error}{conflict && <p>资料可能已被其他人修改，当前输入已保留。<button disabled={busy} onClick={() => void reload()}><RefreshCw size={14} />放弃当前修改并重新加载</button></p>}</div>}
    {notice && <p role="status" className="research-notice">{notice}</p>}
    {creating ? null : loading ? <p role="status">正在读取研究资料…</p> : !validView ? <div className="research-empty"><h2>未找到该视图</h2><button onClick={() => navigate('overview')}>返回项目概览</button></div> : !study ? <div className="research-empty"><h2>{requestedStudy ? '未找到该研究档案' : '尚未建立研究档案'}</h2><p>{requestedStudy ? '请在研究档案中选择有效记录。' : canCreate ? '建立研究后，分别记录四个维度的报告与证据。' : '当前项目尚无研究资料。'}</p></div> : requestedTask && !task ? <div className="research-empty"><h2>未找到该研究中的任务</h2><button onClick={() => navigate('tasks')}>返回四维任务</button></div> : <>
      {view === 'overview' && <><section className="research-section"><div className="research-sectionheading"><h2>{study.title}</h2><span>{completion.count} / 4 已提交或审核</span></div><progress max={100} value={completion.percent} aria-label="四维任务完成率" /><dl className="research-facts"><div><dt>研究对象</dt><dd>{study.researchObject || '待填写'}</dd></div><div><dt>研究目标</dt><dd>{study.goal || '待填写'}</dd></div><div><dt>研究最近更新</dt><dd>{date(study.updatedAt)}</dd></div><div><dt>项目创建时间</dt><dd><time dateTime={project.createdAt}>{date(project.createdAt)}</time></dd></div><div><dt>项目更新时间</dt><dd><time dateTime={project.updatedAt}>{date(project.updatedAt)}</time></dd></div></dl><button onClick={() => navigate('goal')}>查看对象与目标<ArrowUpRight size={14} /></button></section><TaskCards study={study} onOpen={id => navigate('tasks', id)} /><section className="research-section"><h2>交付检查</h2><p>{completion.complete ? '四份报告已齐备，可生成证据汇编并继续人工研判。' : `待提交：${completion.missing.map(item => item.title).join('、')}`}</p><p className="research-muted">任务提示词由你复制至独立会话执行，工作台保存回填资料与审核记录。</p><button onClick={() => navigate('synthesis')}>综合研判<ArrowUpRight size={14} /></button></section></>}
      {view === 'goal' && <GoalEditor key={`${study.id}-${study.updatedAt}-${editorEpoch}`} study={study} canEdit={canEdit} busy={busy} onDirty={markDirty} onSave={value => mutate(() => api(`/research/studies/${study.id}`, request('PUT', { ...value, expectedUpdatedAt: study.updatedAt })), '对象与目标已保存。')} onArchive={() => { if (leave() && window.confirm('归档后本研究只读，历史报告与来源仍保留。确认归档？')) void mutate(() => api(`/research/studies/${study.id}/archive`, request('POST')), '研究已归档。'); }} />}
      {view === 'tasks' && (task ? <TaskEditor key={`${task.id}-${task.revision}-${editorEpoch}`} task={task} study={study} canEdit={canEdit} busy={busy} onDirty={markDirty} onBack={() => navigate('tasks')} onSave={input => mutate(() => api(`/research/tasks/${task.id}`, request('PUT', input)), '任务已保存。')} onSubmit={() => mutate(() => api(`/research/tasks/${task.id}/submit`, request('POST', { revision: task.revision })), '任务已提交。')} onReset={() => mutate(() => api(`/research/tasks/${task.id}/reset`, request('POST', { revision: task.revision })), '任务已重新打开，原报告和来源已保留。')} /> : <TaskCards study={study} onOpen={id => navigate('tasks', id)} />)}
      {view === 'synthesis' && <SynthesisEditor key={`${study.id}-${study.synthesis?.updatedAt}-${editorEpoch}`} study={study} canEdit={canEdit} busy={busy} onDirty={markDirty} onGenerate={() => { if (leave()) void mutate(() => api(`/research/studies/${study.id}/synthesize`, request('POST')), '证据汇编已生成，等待人工分析。'); }} onSave={value => mutate(() => api(`/research/studies/${study.id}/synthesis`, request('PUT', value)), '综合研判已保存。')} onExport={() => void download()} />}
      {view === 'sources' && <section className="research-section"><div className="research-sectionheading"><h2>来源台账</h2><label className="research-search"><Search size={16} /><input aria-label="搜索所有任务来源" placeholder="标题、机构、支持内容" value={query} onChange={event => setQuery(event.target.value)} /></label></div><p className="research-muted">来源核实状态由研究者人工标记；转载数量不代表独立证据数量。</p><div className="research-tablewrap"><table><thead><tr><th>来源 / 机构</th><th>发布日期</th><th>支持内容</th><th>核实状态</th><th>所属任务</th></tr></thead><tbody>{searchResearchSources(study.tasks, query).map(({ source, task: owner }) => <tr key={`${owner.id}-${source.id}`}><td><a href={source.url} target="_blank" rel="noreferrer">{source.id} · {source.title}<ArrowUpRight size={13} /></a><small>{source.publisher}</small></td><td>{source.published}</td><td><details className="research-source-support"><summary>查看支持内容</summary><p>{source.supports}</p></details></td><td>{source.verified ? '人工已核实' : '待核实'}</td><td><button onClick={() => navigate('tasks', owner.id)}>{owner.title}<ArrowUpRight size={13} /></button></td></tr>)}</tbody></table></div>{!searchResearchSources(study.tasks, query).length && <p>没有匹配的来源。</p>}</section>}
      {view === 'history' && <History key={`${study.id}-${task?.id}-${params.get('researchHistory')}`} study={study} task={task} synthesisMode={params.get('researchHistory') === 'synthesis'} onSelect={id => { if (id === 'synthesis') { if (!leave()) return; const next = new URLSearchParams(params); next.set('researchView', 'history'); next.set('researchHistory', 'synthesis'); next.delete('task'); setParams(next); } else navigate('history', Number(id)); }} />}
      {view === 'report' && <ResearchReport study={study} busy={busy} onExport={() => void download()} onSource={query => { setQuery(query); navigate('sources'); }} onTask={id => navigate('tasks', id)} />}
    </>}
  </section>;
}

function TaskCards({ study, onOpen }: { study: ResearchStudyView; onOpen: (id: number) => void }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return <section className="research-section"><h2>四维任务</h2><div className="research-taskgrid">{researchDefinitions.map((definition, index) => {
    const task = study.tasks.find(item => item.kind === definition.kind); const open = expanded.includes(definition.kind);
    const flowPercent = task ? { draft: 0, ready: 25, running: 50, submitted: 100, reviewed: 100 }[task.status] : 0;
    return <article key={definition.kind} className={`research-taskcard research-dimension-${index}`}><div className="research-cardheading"><span>0{index + 1}</span><span className="research-status">{task ? researchStatusLabels[task.status] : '任务缺失'}</span></div><h3>{definition.title}</h3><p>{definition.question}</p><dl><div><dt>负责人</dt><dd>{task?.assignedTo || '未分派'}</dd></div><div><dt>资料</dt><dd>{task?.sources.length ?? 0} 项来源 · {task?.conclusions.length ?? 0} 条结论</dd></div><div><dt>最近更新</dt><dd>{task ? <time dateTime={task.updatedAt}>{date(task.updatedAt)}</time> : '暂无记录'}</dd></div><div><dt>流程进度</dt><dd className="research-taskprogress"><progress max={100} value={flowPercent} aria-label={`${definition.title}流程进度`} /><span>{flowPercent}%</span></dd></div></dl><button className="research-textbutton" aria-expanded={open} onClick={() => setExpanded(open ? expanded.filter(item => item !== definition.kind) : [...expanded, definition.kind])}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}职责详情</button>{open && <div className="research-scope"><p>{definition.scope}</p><p>优先来源：{definition.preferred}</p></div>}<button disabled={!task} onClick={() => task && onOpen(task.id)}><FileText size={15} />查看任务<ArrowUpRight size={14} /></button></article>;
  })}</div></section>;
}

function GoalEditor({ study, canEdit, busy, onDirty, onSave, onArchive }: { study: ResearchStudyView; canEdit: boolean; busy: boolean; onSave: (value: { title: string; researchObject: string; goal: string }) => Promise<boolean>; onArchive: () => void } & DirtyProps) {
  const [value, setValue] = useState({ title: study.title, researchObject: study.researchObject, goal: study.goal });
  const changed = JSON.stringify(value) !== JSON.stringify({ title: study.title, researchObject: study.researchObject, goal: study.goal });
  const allowed = canEdit && study.tasks.every(task => task.status === 'draft');
  useEffect(() => { onDirty(changed); return () => onDirty(false); }, [changed, onDirty]);
  return <form className="research-section research-form" onSubmit={event => { event.preventDefault(); void onSave(value); }}><h2>对象与目标</h2>{canEdit && !allowed && <p className="research-warning">任务已经开始。修改对象或目标前，须逐项重新打开任务至草稿；原结果和历史保留。</p>}<fieldset disabled={!allowed || busy}>{([['title', '研究名称'], ['researchObject', '研究对象'], ['goal', '研究目标']] as const).map(([key, label]) => <label key={key}>{label}{key === 'title' ? <input required maxLength={160} value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} /> : <textarea rows={key === 'goal' ? 5 : 3} maxLength={key === 'goal' ? 3000 : 1000} value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} />}</label>)}</fieldset><div className="research-actions">{allowed && <button type="submit" disabled={busy || !changed}><Save size={15} />保存目标</button>}{canEdit && <button type="button" disabled={busy || changed} onClick={onArchive}><Archive size={15} />归档研究</button>}{changed && <span className="research-unsaved">有未保存的修改</span>}</div></form>;
}

function TaskEditor({ task, study, canEdit, busy, onDirty, onBack, onSave, onSubmit, onReset }: { task: ResearchTaskView; study: ResearchStudyView; canEdit: boolean; busy: boolean; onBack: () => void; onSave: (value: ResearchTaskInput) => Promise<boolean>; onSubmit: () => Promise<boolean>; onReset: () => Promise<boolean> } & DirtyProps) {
  const [value, setValue] = useState(() => taskInput(task));
  const [preview, setPreview] = useState(['submitted', 'reviewed'].includes(task.status));
  const [copyNotice, setCopyNotice] = useState('');
  const [fallback, setFallback] = useState(false);
  const changed = JSON.stringify(value) !== JSON.stringify(taskInput(task));
  const locked = ['submitted', 'reviewed'].includes(task.status);
  const editable = canEdit && !locked;
  useEffect(() => { onDirty(changed); return () => onDirty(false); }, [changed, onDirty]);
  function patch<K extends keyof ResearchTaskInput>(key: K, content: ResearchTaskInput[K]) { setValue(current => ({ ...current, [key]: content })); }
  async function copyPrompt() { const text = `${value.prompt}\n\n输入资料：\n${value.inputMaterials || '暂无额外输入资料'}\n数据截止日期：${value.asOf || '执行前确定'}\n任务备注：${value.notes || '无'}`; try { await navigator.clipboard.writeText(text); setCopyNotice('已复制提示词，请在独立会话手动执行。'); setFallback(false); } catch { setCopyNotice('无法访问剪贴板，请选择下方文本手动复制。'); setFallback(true); } }
  const nextStatus = task.status === 'draft' ? 'ready' : task.status === 'ready' ? 'running' : null;
  return <section className="research-section research-form"><button className="research-textbutton" onClick={onBack}><ArrowLeft size={14} />四维任务</button><div className="research-sectionheading"><h2>{task.title}</h2><span className="research-status">{researchStatusLabels[task.status]} · 修订 {task.revision}</span></div>
    <div className="research-actions"><button onClick={() => void copyPrompt()} disabled={busy}><Copy size={15} />复制任务提示词</button>{editable && <button onClick={() => { if (window.confirm('用当前研究对象和目标更新提示词？现有自定义提示词将被替换。')) patch('prompt', researchPrompt(task.kind, study.researchObject, study.goal)); }} disabled={busy}><RotateCcw size={15} />恢复标准提示词</button>}</div>{copyNotice && <p role="status">{copyNotice}</p>}{fallback && <textarea readOnly rows={8} aria-label="手动复制任务提示词" value={`${value.prompt}\n\n输入资料：\n${value.inputMaterials}\n数据截止日期：${value.asOf || '执行前确定'}\n任务备注：${value.notes}`} onFocus={event => event.target.select()} />}
    {locked && <p className="research-warning">报告已锁定。重新打开后可修改，当前报告和历史版本会保留。</p>}
    <fieldset disabled={!editable || busy}><div className="research-twofields"><label>任务名称<input required maxLength={160} value={value.title} onChange={event => patch('title', event.target.value)} /></label><label>负责人<input maxLength={160} value={value.assignedTo} onChange={event => patch('assignedTo', event.target.value)} /></label></div><label>数据截止日期<input type="date" value={value.asOf} onChange={event => patch('asOf', event.target.value)} /></label><details><summary>任务提示词</summary><label><span className="research-sr">任务提示词正文</span><textarea rows={15} maxLength={15000} value={value.prompt} onChange={event => patch('prompt', event.target.value)} /></label></details><label>输入资料<textarea rows={3} maxLength={15000} value={value.inputMaterials} onChange={event => patch('inputMaterials', event.target.value)} /></label></fieldset>
    <div className="research-sectionheading"><h3>研究报告</h3><div className="research-segment"><button aria-pressed={!preview} onClick={() => setPreview(false)}>正文</button><button aria-pressed={preview} onClick={() => setPreview(true)}>预览</button></div></div>{preview ? <article className="research-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value.report || '暂无报告正文。'}</ReactMarkdown></article> : <label><span className="research-sr">Markdown 报告正文</span><textarea className="research-report" rows={16} maxLength={50000} readOnly={!editable || busy} value={value.report} onChange={event => patch('report', event.target.value)} /></label>}
    <fieldset disabled={!editable || busy}><div className="research-sectionheading"><h3>来源台账（{value.sources.length}）</h3>{editable && <button type="button" disabled={value.sources.length >= 80} onClick={() => { let index = value.sources.length + 1; while (value.sources.some(item => item.id === `S${index}`)) index++; patch('sources', [...value.sources, { id: `S${index}`, title: '', publisher: '', published: '未知', url: '', supports: '', verified: false }]); }}><Plus size={15} />添加来源</button>}</div>{value.sources.map((source, index) => <div className="research-sourceeditor" key={index}><div className="research-sectionheading"><h4>来源 {index + 1}</h4>{editable && <button type="button" className="research-icon" title="移除此来源及其结论关联" aria-label={`移除来源 ${source.id}`} onClick={() => { patch('sources', value.sources.filter((_, item) => item !== index)); patch('conclusions', value.conclusions.map(conclusion => ({ ...conclusion, sourceIds: conclusion.sourceIds.filter(id => id !== source.id) }))); }}><Trash2 size={15} /></button>}</div><div className="research-twofields">{([['id', '编号'], ['title', '标题'], ['publisher', '发布机构'], ['published', '发布日期（YYYY-MM-DD 或未知）'], ['url', '原文 URL']] as const).map(([key, label]) => <label key={key}>{label}<input type={key === 'url' ? 'url' : 'text'} value={source[key]} onChange={event => { const text = event.target.value; patch('sources', value.sources.map((item, at) => at === index ? { ...item, [key]: text } : item)); if (key === 'id') patch('conclusions', value.conclusions.map(conclusion => ({ ...conclusion, sourceIds: conclusion.sourceIds.map(id => id === source.id ? text : id) }))); }} /></label>)}</div><label>支持内容<textarea rows={2} value={source.supports} onChange={event => patch('sources', value.sources.map((item, at) => at === index ? { ...item, supports: event.target.value } : item))} /></label><label className="research-checkbox"><input type="checkbox" checked={source.verified} onChange={event => patch('sources', value.sources.map((item, at) => at === index ? { ...item, verified: event.target.checked } : item))} />人工已核实原文及支持范围</label></div>)}
    <div className="research-sectionheading"><h3>核心结论（{value.conclusions.length} / 3—8）</h3>{editable && <button type="button" disabled={value.conclusions.length >= 8} onClick={() => patch('conclusions', [...value.conclusions, { text: '', type: 'hypothesis', sourceIds: [] }])}><Plus size={15} />添加结论</button>}</div>{value.conclusions.map((conclusion, index) => <div className="research-conclusioneditor" key={index}><div className="research-sectionheading"><label>证据类型<select value={conclusion.type} onChange={event => patch('conclusions', value.conclusions.map((item, at) => at === index ? { ...item, type: event.target.value as typeof conclusion.type } : item))}>{Object.entries(conclusionLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>{editable && <button className="research-icon" title="移除结论" aria-label={`移除结论 ${index + 1}`} onClick={() => patch('conclusions', value.conclusions.filter((_, at) => at !== index))}><Trash2 size={15} /></button>}</div><label>结论 {index + 1}<textarea rows={3} maxLength={3000} value={conclusion.text} onChange={event => patch('conclusions', value.conclusions.map((item, at) => at === index ? { ...item, text: event.target.value } : item))} /></label><div className="research-sourcechecks"><span>关联来源</span>{value.sources.map(source => <label className="research-checkbox" key={source.id}><input type="checkbox" checked={conclusion.sourceIds.includes(source.id)} onChange={event => patch('conclusions', value.conclusions.map((item, at) => at === index ? { ...item, sourceIds: event.target.checked ? [...item.sourceIds, source.id] : item.sourceIds.filter(id => id !== source.id) } : item))} />{source.id} · {source.title || '未命名来源'}</label>)}{!value.sources.length && <small>请先添加来源。</small>}</div></div>)}
    {([['limitations', '研究局限'], ['openQuestions', '待验证问题'], ['notes', '备注']] as const).map(([key, label]) => <label key={key}>{label}<textarea rows={3} maxLength={5000} value={value[key]} onChange={event => patch(key, event.target.value)} /></label>)}</fieldset>
    <p className="research-muted">提交需要报告、至少一项来源、3—8条结论、数据截止日期、研究局限和待验证问题。已核实事实须关联核实过的来源。</p>
    <div className="research-actions research-savebar">{editable && <><button disabled={busy || !changed} onClick={() => void onSave(value)}><Save size={15} />保存草稿内容</button>{nextStatus && <button disabled={busy || changed} onClick={() => void onSave({ ...value, status: nextStatus })}><Check size={15} />{nextStatus === 'ready' ? '标为待分派' : '标为进行中'}</button>}{task.status === 'running' && <button disabled={busy || changed} onClick={() => { if (window.confirm('确认提交本任务？提交后内容锁定，修改需重新打开。')) void onSubmit(); }}><Check size={15} />提交任务</button>}</>}{canEdit && task.status === 'submitted' && <button disabled={busy} onClick={() => { if (window.confirm('已人工复核报告、来源与结论，确认标为已审核？')) void onSave({ ...taskInput(task), status: 'reviewed' }); }}><Check size={15} />人工审核通过</button>}{canEdit && task.status !== 'draft' && <button disabled={busy} onClick={() => { if (window.confirm(`${changed ? '当前未保存的修改将被放弃。' : ''}重新打开至草稿？已保存的报告、来源、结论和历史版本会保留，综合研判将失效。`)) void onReset(); }}><RotateCcw size={15} />重新打开</button>}{changed && <span className="research-unsaved">有未保存的修改</span>}</div>
  </section>;
}

function SynthesisEditor({ study, canEdit, busy, onDirty, onGenerate, onSave, onExport }: { study: ResearchStudyView; canEdit: boolean; busy: boolean; onGenerate: () => void; onSave: (value: unknown) => Promise<boolean>; onExport: () => void } & DirtyProps) {
  const synthesis = study.synthesis;
  const [value, setValue] = useState<ResearchSynthesisView | null>(synthesis);
  const changed = JSON.stringify(value) !== JSON.stringify(synthesis);
  const completion = researchCompletion(study.tasks);
  useEffect(() => { onDirty(changed); return () => onDirty(false); }, [changed, onDirty]);
  function save(status: 'draft' | 'reviewed') {
    if (!value) return;
    const content = Object.fromEntries(synthesisFields.map(([key]) => [key, value[key]]));
    void onSave({ ...content, openQuestions: value.openQuestions.map(question => question.trim()).filter(Boolean), status, expectedUpdatedAt: synthesis?.updatedAt });
  }
  return <section className="research-section research-form"><div className="research-sectionheading"><h2>综合研判</h2>{synthesis && <span className="research-status">{synthesis.status === 'stale' ? '已失效' : synthesis.status === 'reviewed' ? '已人工审核' : '待人工分析'}</span>}</div><p>生成结果是四维报告的证据汇编。市场判断、冲突证据与进入条件需由负责人继续分析。</p>{!completion.complete && <p className="research-warning">尚缺：{completion.missing.map(item => item.title).join('、')}。四维任务全部提交或审核后才能生成。</p>}{synthesis?.status === 'stale' && <p className="research-warning">任务已发生变化，此综合研判已失效。重新提交所有任务并生成后方可再次审核；历史内容仅供参考。</p>}<div className="research-actions">{canEdit && (!synthesis || synthesis.status === 'stale') && <button disabled={busy || !completion.complete || changed} onClick={() => { if (!synthesis || window.confirm('重新生成将替换当前综合研判内容，确认继续？')) onGenerate(); }}><RefreshCw size={15} />{synthesis ? '重新生成证据汇编' : '生成证据汇编'}</button>}{synthesis && <button disabled={busy || changed} onClick={onExport}><Download size={15} />导出 Markdown{synthesis.status === 'stale' ? '（已失效）' : ''}</button>}</div>{!value ? <div className="research-empty">尚未生成综合研判。</div> : <><p className="research-muted">关键判断请保留来源引用，例如 [task#12/S1]；编号对应四维任务及其来源台账。</p><fieldset disabled={!canEdit || busy || synthesis?.status === 'stale'}>{synthesisFields.map(([key, label]) => <label key={key}>{label}<textarea rows={key === 'executiveSummary' ? 8 : 5} value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} /></label>)}<label>待验证问题（每行一项）<textarea rows={5} value={value.openQuestions.join('\n')} onChange={event => setValue({ ...value, openQuestions: event.target.value.split('\n') })} /></label></fieldset><div className="research-actions">{canEdit && synthesis?.status !== 'stale' && <><button disabled={busy || !changed} onClick={() => save('draft')}><Save size={15} />保存研判</button><button disabled={busy || changed || !completion.complete || synthesis?.status === 'reviewed'} onClick={() => { if (window.confirm('已人工核对证据并完成分析，确认审核综合研判？')) save('reviewed'); }}><Check size={15} />人工审核通过</button></>}{changed && <span className="research-unsaved">有未保存的修改</span>}</div></>}</section>;
}

function History({ study, task, synthesisMode, onSelect }: { study: ResearchStudyView; task?: ResearchTaskView; synthesisMode: boolean; onSelect: (id: string) => void }) {
  const [versions, setVersions] = useState<ResearchVersionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  useEffect(() => { if (!task) return; let active = true; setLoading(true); setError(''); api<ResearchVersionView[]>(`/research/tasks/${task.id}/versions`).then(rows => { if (active) { setVersions(rows); setBeforeId(String(rows.length > 1 ? rows[1].id : rows[0]?.id ?? '')); setAfterId(String(rows[0]?.id ?? '')); } }).catch(reason => { if (active) setError(messageOf(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [task?.id, retry]);
  const before = versions.find(item => String(item.id) === beforeId); const after = versions.find(item => String(item.id) === afterId);
  const differences = before && after ? researchVersionDiff(before, after) : [];
  return <section className="research-section"><h2>历史版本</h2><label className="research-historyselect">报告<select value={synthesisMode ? 'synthesis' : task?.id ?? ''} onChange={event => onSelect(event.target.value)}><option value="" disabled>选择任务或总控报告</option>{study.tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}<option value="synthesis">总控综合研判</option></select></label>{synthesisMode ? <SynthesisHistory studyId={study.id} /> : !task ? <p>选择任务以查看提交、审核及重新打开的历史快照，或选择总控报告查看历次研判。</p> : loading ? <p role="status">正在读取历史…</p> : error ? <p role="alert">{error}<button onClick={() => setRetry(retry + 1)}><RefreshCw size={14} />重试</button></p> : !versions.length ? <p>暂无历史快照。</p> : <><div className="research-twofields">{[['before', '变更前', beforeId], ['after', '变更后', afterId]].map(([key, label, selected]) => <label key={key}>{label}<select value={selected} onChange={event => key === 'before' ? setBeforeId(event.target.value) : setAfterId(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>版本 {version.version} · {date(version.createdAt)}</option>)}</select></label>)}</div>{differences.map(item => <section className="research-diff" key={item.field}><h3>{item.field}</h3><div><pre aria-label={`${item.field}变更前`}>{item.before || '（空）'}</pre><pre aria-label={`${item.field}变更后`}>{item.after || '（空）'}</pre></div></section>)}{!differences.length && <p>两个快照的内容相同。</p>}</>}</section>;
}

function SynthesisHistory({ studyId }: { studyId: number }) {
  type Version = { id: number; snapshot: ResearchSynthesisView; createdAt: string };
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  useEffect(() => { let active = true; setLoading(true); setError(''); api<Version[]>(`/research/studies/${studyId}/synthesis/versions`).then(rows => { if (active) { setVersions(rows); setBeforeId(String(rows.length > 1 ? rows[1].id : rows[0]?.id ?? '')); setAfterId(String(rows[0]?.id ?? '')); } }).catch(reason => { if (active) setError(messageOf(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [studyId, retry]);
  const before = versions.find(item => String(item.id) === beforeId)?.snapshot;
  const after = versions.find(item => String(item.id) === afterId)?.snapshot;
  const fields = [...synthesisFields, ['openQuestions', '待验证问题'], ['status', '状态'], ['sourceTaskIds', '来源任务']] as const;
  const changes = before && after ? fields.filter(([key]) => JSON.stringify(before[key]) !== JSON.stringify(after[key])) : [];
  const renderValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return loading ? <p role="status">正在读取总控历史…</p> : error ? <p role="alert">{error}<button onClick={() => setRetry(retry + 1)}><RefreshCw size={14} />重试</button></p> : !versions.length ? <p>暂无总控历史快照。</p> : <><div className="research-twofields">{[['before', '变更前', beforeId], ['after', '变更后', afterId]].map(([key, label, selected]) => <label key={key}>{label}<select value={selected} onChange={event => key === 'before' ? setBeforeId(event.target.value) : setAfterId(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>快照 {version.id} · {date(version.createdAt)}</option>)}</select></label>)}</div>{before && after && changes.map(([key, label]) => <section key={key} className="research-diff"><h3>{label}</h3><div><pre aria-label={`${label}变更前`}>{renderValue(before[key]) || '（空）'}</pre><pre aria-label={`${label}变更后`}>{renderValue(after[key]) || '（空）'}</pre></div></section>)}{!changes.length && <p>两个快照的内容相同。</p>}</>;
}
