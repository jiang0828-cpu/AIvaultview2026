import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowLeft, BookOpen, CalendarDays, Check, ClipboardList, Download, Heart, HeartPulse, Leaf, Pencil, Phone, Pill, Plus, Printer, RefreshCw, ShieldCheck, Stethoscope, Trash2, Users, X } from 'lucide-react';
import { emptyHealthWorkspace, type HealthAction, type HealthMeasurement, type HealthMedication, type HealthMember, type HealthReview, type HealthSnapshot, type HealthVisit, type HealthWorkspace, type MeasurementKind } from '../../shared/health';
import { api, ApiError } from './api';
import { ContentBody } from './components';
import type { Content } from './types';
import { dueCareItems, focusCount, healthDateTime, healthSummary, healthToday, localInputDateTime, measurementKinds, measurementSeries, measurementValue, memberRecords, nextRecurringAction, removeMember } from './healthModel';
import './health.css';

const views = [ ['today', '今日', Heart], ['members', '健康档案', Users], ['records', '日常记录', Activity], ['plans', '行动计划', ClipboardList], ['care', '就医协作', Stethoscope], ['guide', '健康指南', BookOpen] ] as const;
type View = typeof views[number][0];
type RecordKind = keyof HealthWorkspace;
type HealthRecord = HealthWorkspace[RecordKind][number];
type Editor = { kind: RecordKind; value: HealthRecord };
const managementNames = { general: '一般健康', risk: '风险增加', stable: '慢病稳定', changing: '近期变化 / 复杂需求' };
const actionStates = { todo: '待处理', doing: '处理中', waiting: '待结果', done: '已完成' };
const categoryNames = { lifestyle: '生活方式', medication: '用药核对', followup: '随访复诊', prevention: '预防保健', other: '其他' };
const kindTitles: Record<RecordKind, string> = { members: '成员档案', measurements: '健康记录', actions: '行动', medications: '药物', visits: '就医事项', reviews: '每周回顾' };
const limits: Record<RecordKind, number> = { members: 12, measurements: 600, actions: 150, medications: 100, visits: 100, reviews: 100 };
const uid = () => `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const text = (value: string) => value.trim() || '未记录';
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : '保存失败，请稍后重试';

function newRecord(kind: RecordKind, memberId: string): HealthRecord {
  const id = uid(); const date = healthToday();
  if (kind === 'members') return { id, name: '', birthDate: '', relationship: '', management: 'general', conditions: '', allergies: '', emergencyContact: '', doctor: '', hospital: '', doctorContact: '', goals: '', monitoringPlan: '', consent: false };
  if (kind === 'measurements') return { id, memberId, kind: 'bloodPressure', measuredAt: localInputDateTime(), value: Number.NaN, secondary: Number.NaN, context: '', source: 'self', note: '' };
  if (kind === 'actions') return { id, memberId, title: '', category: 'lifestyle', dueDate: date, owner: '', focus: false, status: 'todo', evidence: '', obstacle: '', recurrence: 'none' };
  if (kind === 'medications') return { id, memberId, name: '', strength: '', dose: '', schedule: '', purpose: '', prescriber: '', notes: '', reviewDate: '' };
  if (kind === 'visits') return { id, memberId, date, institution: '', reason: '', questions: '', status: 'planned', outcome: '', nextDate: '' };
  return { id, memberId, date, changes: '', support: '', nextSteps: '', simplify: '' };
}

function downloadFile(value: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function Trend({ rows, kind }: { rows: HealthMeasurement[]; kind: MeasurementKind }) {
  if (!rows.length) return <div className="health-empty">还没有这项记录。只记录对你有用、或医生安排的项目。</div>;
  const values = rows.flatMap(row => row.kind === 'bloodPressure' && row.secondary !== null ? [row.value, row.secondary] : [row.value]);
  const low = Math.min(...values); const high = Math.max(...values); const span = Math.max(high - low, 1);
  const x = (index: number) => 48 + index * 654 / Math.max(rows.length - 1, 1);
  const y = (value: number) => 176 - (value - low) / span * 130;
  const points = (second = false) => rows.map((row, index) => `${x(index)},${y(second ? row.secondary ?? row.value : row.value)}`).join(' ');
  return <div className="health-trend"><div className="health-trend-key"><span><i />{kind === 'bloodPressure' ? '收缩压' : measurementKinds[kind].label}</span>{kind === 'bloodPressure' && <span><i className="secondary" />舒张压</span>}<small>最近 {rows.length} 条 · {measurementKinds[kind].unit} · 仅作记录趋势</small></div>
    <svg viewBox="0 0 740 224" role="img" aria-label={`${measurementKinds[kind].label}最近${rows.length}条记录趋势`}>
      {[low, low + span / 2, low + span].map((value, index) => <g key={index}><line x1="44" x2="710" y1={y(value)} y2={y(value)} stroke="#dce7e0" /><text x="4" y={y(value) + 4} fill="#60746b" fontSize="12">{value.toFixed(1)}</text></g>)}
      <polyline fill="none" stroke="#29745d" strokeWidth="3" points={points()} />
      {kind === 'bloodPressure' && <polyline fill="none" stroke="#c26b60" strokeWidth="3" points={points(true)} />}
      {rows.map((row, index) => <g key={row.id}><circle cx={x(index)} cy={y(row.value)} r="4" fill="#29745d"><title>{healthDateTime(row.measuredAt)} {measurementValue(row)}</title></circle>{row.secondary !== null && kind === 'bloodPressure' && <circle cx={x(index)} cy={y(row.secondary)} r="4" fill="#c26b60" />}</g>)}
      <text x="48" y="212" fontSize="12" fill="#60746b">{healthDateTime(rows[0].measuredAt).split(' ')[0]}</text><text x="702" y="212" textAnchor="end" fontSize="12" fill="#60746b">{healthDateTime(rows[rows.length - 1].measuredAt).split(' ')[0]}</text>
    </svg><p className="health-caption">折线连接观测值，不代表连续监测或诊断。不同测量条件请结合原始记录核对。</p></div>;
}

export function HealthSpace({ project, onBack }: { project: Content; onBack: () => void }) {
  const [view, setView] = useState<View>('today');
  const [snapshot, setSnapshot] = useState<HealthSnapshot>({ version: 0, updatedAt: null, data: emptyHealthWorkspace() });
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [memberId, setMemberId] = useState('all'); const [trendKind, setTrendKind] = useState<MeasurementKind>('bloodPressure');
  const [editor, setEditor] = useState<Editor | null>(null); const [summaryMember, setSummaryMember] = useState<string | null>(null);
  const [pending, setPending] = useState<HealthWorkspace | null>(null); const [conflict, setConflict] = useState(false);
  const [guideId, setGuideId] = useState<number | null>(null); const mutationLock = useRef(false);
  const path = `/health/workspace?projectId=${project.id}`;
  const data = snapshot.data; const today = healthToday();
  const todayItems = dueCareItems(data, memberId, today);
  const memberName = (id: string) => data.members.find(member => member.id === id)?.name || '成员已移除';
  const filtered = <T extends { memberId: string }>(rows: T[]) => memberRecords(rows, memberId);
  const activeMember = data.members.find(member => member.id === memberId);
  const chartMemberId = activeMember?.id || (memberId === 'all' && data.members.length === 1 ? data.members[0].id : 'all');
  const summaryPerson = data.members.find(member => member.id === summaryMember);
  const guideDocs = (project.children || []).filter(item => item.type === 'text').sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const guide = guideDocs.find(item => item.id === guideId) || guideDocs[0];
  const hasDialog = Boolean(editor || summaryMember);

  useEffect(() => {
    if (!hasDialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.querySelector<HTMLElement>('.health-modal');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape' && !mutationLock.current) { setEditor(null); setSummaryMember(null); }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')).filter(element => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [hasDialog]);

  useEffect(() => {
    let active = true;
    setReady(false);
    void api<HealthSnapshot>(path).then(value => { if (active) { setSnapshot(value); setReady(true); } }).catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [path]);

  async function reload() {
    if (mutationLock.current) return;
    if ((pending || editor) && !window.confirm('重新加载会放弃当前未保存的输入，尚未提交的表单不会保留。确定重新加载吗？')) return;
    mutationLock.current = true; setBusy(true); setError('');
    try { setSnapshot(await api<HealthSnapshot>(path)); setReady(true); setPending(null); setConflict(false); setEditor(null); setNotice('已加载最新资料'); }
    catch (cause) { setError(errorMessage(cause)); } finally { mutationLock.current = false; setBusy(false); }
  }

  async function persist(next: HealthWorkspace): Promise<boolean> {
    if (mutationLock.current || conflict) return false;
    mutationLock.current = true; setBusy(true); setError(''); setNotice(''); setPending(next);
    try {
      const value = await api<HealthSnapshot>(path, { method: 'PUT', body: JSON.stringify({ version: snapshot.version, data: next }) });
      setSnapshot(value); setPending(null); setNotice('已保存到本账号健康工作区'); return true;
    } catch (cause) { setError(errorMessage(cause)); if (cause instanceof ApiError && cause.status === 409) setConflict(true); return false; }
    finally { mutationLock.current = false; setBusy(false); }
  }

  function openEditor(kind: RecordKind, record?: HealthRecord) {
    if (busy || !ready) return;
    if (kind !== 'members' && !data.members.length) { setView('members'); setNotice('先建立一份成员档案，再添加记录。'); return; }
    if (!record && data[kind].length >= limits[kind]) { setError(`此类资料已达到 ${limits[kind]} 条，请先导出并整理旧记录。`); return; }
    const value = record ? structuredClone(record) : newRecord(kind, activeMember?.id || data.members[0]?.id || '');
    if (kind === 'measurements' && record) (value as HealthMeasurement).measuredAt = localInputDateTime((record as HealthMeasurement).measuredAt);
    setError(''); setEditor({ kind, value });
  }

  async function saveEditor(event: FormEvent) {
    event.preventDefault(); if (!editor || busy) return;
    const value = structuredClone(editor.value); const next = structuredClone(data);
    if (editor.kind === 'measurements') {
      const row = value as HealthMeasurement;
      if (!row.measuredAt || Number.isNaN(Date.parse(row.measuredAt))) { setError('请填写有效的记录时间'); return; }
      row.measuredAt = new Date(row.measuredAt).toISOString();
      if (row.kind !== 'bloodPressure') row.secondary = null;
    }
    if (editor.kind === 'members' && !(value as HealthMember).consent) { setError('请先确认本人同意，或由有权监护人管理'); return; }
    if (editor.kind === 'actions') {
      const row = value as HealthAction;
      const existing = data.actions.find(item => item.id === row.id);
      if (existing?.status === 'done' && existing.recurrence && existing.recurrence !== 'none' && row.status !== 'done') {
        setError('此重复行动已完成并安排了下一期，请直接编辑下一期，避免重复生成任务。'); return;
      }
      if (row.status === 'done' && !row.evidence.trim()) { setError('完成行动前，请填写完成结果或凭证'); return; }
      if (row.focus && row.status !== 'done' && data.actions.filter(item => item.memberId === row.memberId && item.id !== row.id && item.focus && item.status !== 'done').length >= 3) { setError('每位成员最多保留三个未完成的阶段重点'); return; }
    }
    if (editor.kind === 'visits' && (value as HealthVisit).status === 'done' && !(value as HealthVisit).outcome.trim()) { setError('请记录就医结果和下一步，才能完成此事项'); return; }
    const upsert = <T extends { id: string }>(rows: T[], row: T) => [...rows.filter(item => item.id !== row.id), row];
    if (editor.kind === 'members') next.members = upsert(next.members, value as HealthMember);
    if (editor.kind === 'measurements') next.measurements = upsert(next.measurements, value as HealthMeasurement);
    if (editor.kind === 'actions') {
      const row = value as HealthAction;
      next.actions = upsert(next.actions, row);
      if (data.actions.find(item => item.id === row.id)?.status !== 'done') {
        const recurring = nextRecurringAction(row, today, uid());
        if (recurring) next.actions.push(recurring);
      }
    }
    if (editor.kind === 'medications') next.medications = upsert(next.medications, value as HealthMedication);
    if (editor.kind === 'visits') next.visits = upsert(next.visits, value as HealthVisit);
    if (editor.kind === 'reviews') next.reviews = upsert(next.reviews, value as HealthReview);
    if (await persist(next)) setEditor(null);
  }

  async function deleteRecord(kind: RecordKind, id: string) {
    if (busy || conflict || !window.confirm(kind === 'members' ? '删除此成员及其全部健康记录、药单、行动、预约和回顾？请先确认已备份。' : `确定删除这条${kindTitles[kind]}？`)) return;
    const next = kind === 'members' ? removeMember(data, id) : { ...data, [kind]: data[kind].filter(item => item.id !== id) };
    if (await persist(next) && kind === 'members' && memberId === id) setMemberId('all');
  }

  async function clearWorkspace() {
    if (busy || conflict || !window.confirm('清除本账号在此项目中的全部健康资料？此操作不影响其他账号，清除前请先导出备份。')) return;
    mutationLock.current = true; setBusy(true); setError('');
    try { setSnapshot(await api<HealthSnapshot>(path, { method: 'DELETE', body: JSON.stringify({ version: snapshot.version }) })); setMemberId('all'); setPending(null); setEditor(null); setNotice('本账号健康资料已清除'); }
    catch (cause) { setError(errorMessage(cause)); if (cause instanceof ApiError && cause.status === 409) setConflict(true); }
    finally { mutationLock.current = false; setBusy(false); }
  }

  function exportData(value = pending || data) {
    if (window.confirm('导出文件包含健康隐私，请保存在自己可信的设备上。继续导出吗？')) downloadFile(JSON.stringify({ exportedAt: new Date().toISOString(), data: value }, null, 2), 'application/json;charset=utf-8', `family-health-${today}.json`);
  }
  const recordTools = (kind: RecordKind, row: HealthRecord) => <div className="health-row-tools"><button type="button" className="icon-button" title={`编辑${kindTitles[kind]}`} disabled={busy || conflict} onClick={() => openEditor(kind, row)}><Pencil size={16} /></button><button type="button" className="icon-button" title={`删除${kindTitles[kind]}`} disabled={busy || conflict} onClick={() => void deleteRecord(kind, row.id)}><Trash2 size={16} /></button></div>;
  const addButton = (kind: RecordKind, label = `新增${kindTitles[kind]}`) => <button className="button" disabled={busy || conflict || !ready} onClick={() => openEditor(kind)}><Plus size={16} />{label}</button>;
  const showSummary = (id = activeMember?.id || data.members[0]?.id) => { if (id) setSummaryMember(id); };
  const selectedSummary = summaryPerson ? healthSummary(data, summaryPerson) : '';

  return <section className="health-space" aria-labelledby="health-title">
    <div className="health-topline"><button className="back-link" onClick={onBack}><ArrowLeft size={15} />生活场景</button><span><ShieldCheck size={14} />本账号私有 · 家庭资料由你管理</span></div>
    <header className="health-header"><div><p className="health-eyebrow"><Leaf size={17} />基础生活 · 健</p><h1 id="health-title">健康管理</h1><p>照顾好自己，也照顾好在意的人。</p></div><div className="health-header-actions"><button className="button secondary" disabled={!data.members.length || busy} onClick={() => showSummary()}><ClipboardList size={16} />就诊摘要</button><button className="icon-button" title="重新加载资料" disabled={busy} onClick={() => void reload()}><RefreshCw size={18} /></button></div></header>
    <div className="health-context"><label><Users size={16} />查看成员<select aria-label="查看成员" value={memberId} onChange={event => setMemberId(event.target.value)}><option value="all">全家</option>{data.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><span>{snapshot.updatedAt ? `已保存 ${healthDateTime(snapshot.updatedAt)}` : '从一份最小档案开始'}{busy ? ' · 保存中…' : ''}</span></div>
    <nav className="health-nav" aria-label="健康管理导航">{views.map(([key, label, Icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}><Icon size={17} />{label}</button>)}</nav>
    {error && <div className="health-message error" role="alert">{error}</div>}{notice && <div className="health-message" role="status">{notice}</div>}
    {conflict && <div className="health-conflict"><strong>资料已在其他页面更新，当前输入仍然保留。</strong><p>先导出未保存草稿，再重新加载最新资料并核对，避免覆盖其他更改。</p><button className="button secondary" onClick={() => exportData()}>导出未保存草稿</button><button className="button secondary" disabled={busy} onClick={() => void reload()}>重新加载</button></div>}
    {!ready ? <div className="health-empty">{error ? '暂时无法读取资料，请点击重新加载。' : '正在读取你的家庭健康工作区…'}</div> : <>
      {view === 'today' && <>
        <div className="health-section-head"><div><p className="health-eyebrow">{today} · 日常照护</p><h2>今天，先做好这几件事</h2></div>{addButton('actions', '安排一件事')}</div>
        {!data.members.length ? <div className="health-start"><div className="health-start-icon"><HeartPulse size={38} /></div><div><h3>先认识需要照顾的人</h3><p>先填昵称、过敏、正在使用的药和紧急联系人。其他信息可以慢慢补齐。</p><button className="button" onClick={() => openEditor('members')}><Plus size={16} />建立第一份档案</button></div></div> : <>
          <div className="health-stats"><div><span>今日与逾期待办</span><strong>{todayItems.length}</strong><small>行动、预约、复诊与药单核对</small></div><div><span>尚待就医结果</span><strong>{filtered(data.visits).filter(row => row.status === 'waiting').length}</strong><small>拿到结果后登记下一步</small></div><div><span>阶段重点</span><strong>{filtered(data.actions).filter(row => row.focus && row.status !== 'done').length}</strong><small>每人最多三项</small></div></div>
          <div className="health-today-layout"><section className="health-action-list" aria-label="今日待办">{todayItems.length ? todayItems.map(item => <article key={item.id}><div className={`health-date-badge${item.dueDate < today ? ' overdue' : ''}`}><CalendarDays size={18} /><span>{item.dueDate < today ? '逾期' : '今天'}</span></div><div><h3>{item.title}</h3><p>{memberName(item.memberId)} · {item.dueDate}</p><small>{item.detail}</small></div><button className="icon-button" title={`更新${kindTitles[item.kind]}`} disabled={busy || conflict} onClick={() => openEditor(item.kind, item.record)}><Pencil size={17} /></button></article>) : <div className="health-empty"><Check size={26} /><p>今天没有登记的待办。</p><small>有新变化再记录，健康成员不必为了打卡而测量。</small></div>}</section>
            <aside className="health-quick"><h3>随手记，及时查</h3><button onClick={() => openEditor('measurements')}><Activity size={20} /><span>记一条健康记录<small>保留时间、条件和来源</small></span><Plus size={17} /></button><button onClick={() => { setView('care'); }}><Pill size={20} /><span>核对完整药单<small>处方药、非处方药与补充剂</small></span></button><button onClick={() => openEditor('visits')}><Stethoscope size={20} /><span>登记就医与复诊<small>提问、结果、下一次安排</small></span><Plus size={17} /></button><button onClick={() => openEditor('reviews')}><Leaf size={20} /><span>做一次家庭回顾<small>什么有帮助，什么可以减少</small></span><Plus size={17} /></button></aside></div>
          <section className="health-member-strip"><h2>每个人，都值得被好好照顾</h2><div>{(activeMember ? [activeMember] : data.members).map(member => <article key={member.id}><div className="health-member-avatar"><Heart size={20} /></div><div><h3>{member.name}</h3><p>{managementNames[member.management]} · {focusCount(data, member.id)}项重点</p><p><strong>过敏：</strong>{text(member.allergies)}</p><button className="back-link" onClick={() => showSummary(member.id)}>查看一页健康摘要</button></div></article>)}</div></section>
        </>}
      </>}
      {view === 'members' && <>
        <div className="health-section-head"><div><h2>每人一份健康档案</h2><p>成年人须本人同意；儿童由有权监护人管理。空白表示未知，不代表正常。</p></div>{addButton('members')}</div>
        <div className="health-member-grid">{(activeMember ? [activeMember] : data.members).map(member => <article className="health-member-card" key={member.id}><header><div><h3>{member.name}</h3><span>{text(member.relationship)} · {member.birthDate || '生日未记录'}</span></div>{recordTools('members', member)}</header><p className="health-state">{managementNames[member.management]}</p><dl><dt>病史</dt><dd>{text(member.conditions)}</dd><dt>过敏物及反应</dt><dd>{text(member.allergies)}</dd><dt>当前诉求</dt><dd>{text(member.goals)}</dd><dt>紧急联系</dt><dd>{text(member.emergencyContact)}</dd><dt>医生与机构</dt><dd>{text(member.doctor)} / {text(member.hospital)}</dd><dt>医生联系</dt><dd>{text(member.doctorContact)}</dd><dt>监测计划</dt><dd>{text(member.monitoringPlan)}</dd></dl><button className="button secondary" onClick={() => showSummary(member.id)}><ClipboardList size={16} />一页摘要</button></article>)}</div>
        {!data.members.length && <div className="health-empty">还没有成员档案。你可以只填一份最小档案，之后再补充。</div>}
        <div className="health-inline-note"><ShieldCheck size={18} /><p>这里是当前登录账号的私有资料，不会自动分享给其他项目用户。请勿录入未获授权的家人信息；首版不提供跨账号家庭共享。</p></div>
      </>}
      {view === 'records' && <>
        <div className="health-section-head"><div><h2>记录变化，保留测量背景</h2><p>按实际需要或医生计划记录，不以单次读数作诊断。</p></div>{addButton('measurements')}</div>
        <div className="health-trend-toolbar"><label>趋势项目<select aria-label="趋势项目" value={trendKind} onChange={event => setTrendKind(event.target.value as MeasurementKind)}>{Object.entries(measurementKinds).map(([key, item]) => <option key={key} value={key}>{item.label} · {item.unit}</option>)}</select></label><span>{chartMemberId === 'all' ? '请选择一位成员查看趋势，避免混合不同人的数据。' : `当前趋势：${memberName(chartMemberId)}`}</span></div>
        <Trend rows={measurementSeries(data.measurements, chartMemberId, trendKind)} kind={trendKind} />
        <div className="health-table-wrap"><table><caption>原始健康记录 · 保留单位和来源</caption><thead><tr><th>成员 / 时间</th><th>项目 / 数值</th><th>测量条件</th><th>来源 / 备注</th><th>操作</th></tr></thead><tbody>{filtered(data.measurements).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt)).map(row => <tr key={row.id}><td>{memberName(row.memberId)}<small>{healthDateTime(row.measuredAt)}</small></td><td>{measurementKinds[row.kind].label}<strong>{measurementValue(row)}</strong></td><td>{text(row.context)}</td><td>{row.source === 'self' ? '本人记录' : row.source === 'device' ? '设备读数' : '医疗机构'}<small>{text(row.note)}</small></td><td>{recordTools('measurements', row)}</td></tr>)}</tbody></table></div>
        {!filtered(data.measurements).length && <div className="health-empty">暂无健康记录。</div>}
      </>}
      {view === 'plans' && <>
        <div className="health-section-head"><div><h2>把关注变成能完成的行动</h2><p>每项都写明责任人、期限、完成结果；重点少一点，执行更轻松。</p></div>{addButton('actions')}</div>
        <div className="health-table-wrap"><table><caption>行动与随访清单</caption><thead><tr><th>行动 / 成员</th><th>责任人 / 截止日</th><th>状态</th><th>结果与困难</th><th>操作</th></tr></thead><tbody>{filtered(data.actions).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.dueDate.localeCompare(b.dueDate)).map(row => <tr key={row.id}><td><strong>{row.title}</strong>{memberName(row.memberId)} · {categoryNames[row.category]}{row.focus && <span className="health-chip">阶段重点</span>}{row.recurrence && row.recurrence !== 'none' && <small>{row.recurrence === 'daily' ? '每日' : '每周'} · 完成后安排下一期</small>}</td><td>{row.owner}<small className={row.status !== 'done' && row.dueDate < today ? 'health-overdue' : ''}>{row.dueDate}</small></td><td>{actionStates[row.status]}</td><td>{row.evidence || '结果待记录'}<small>{row.obstacle ? `困难：${row.obstacle}` : ''}</small></td><td>{recordTools('actions', row)}</td></tr>)}</tbody></table></div>
        {!filtered(data.actions).length && <div className="health-empty">从一件可做到的小事开始，例如晚饭后散步10分钟；个人病情和活动强度按医生建议调整。</div>}
        <div className="health-section-head health-section-divider"><div><h2>每周一次，轻轻回顾</h2><p>发现执行困难，不给家人打健康分。</p></div>{addButton('reviews', '记录周回顾')}</div>
        <div className="health-review-list">{filtered(data.reviews).sort((a, b) => b.date.localeCompare(a.date)).map(row => <article key={row.id}><header><h3>{memberName(row.memberId)} · {row.date}</h3>{recordTools('reviews', row)}</header><dl><dt>本周变化</dt><dd>{text(row.changes)}</dd><dt>需要支持</dt><dd>{text(row.support)}</dd><dt>下周重点</dt><dd>{text(row.nextSteps)}</dd><dt>可以减少</dt><dd>{text(row.simplify)}</dd></dl></article>)}</div>
        {!filtered(data.reviews).length && <div className="health-empty">还没有周回顾。约15分钟是便捷性设计，不是医学要求。</div>}
      </>}
      {view === 'care' && <>
        <div className="health-section-head"><div><h2>带齐信息，和医生一起决定</h2><p>这里整理就医资料与联系方式，尚未接入在线医生、自动提醒或处方服务。</p></div><button className="button secondary" disabled={!data.members.length} onClick={() => showSummary()}><ClipboardList size={16} />就诊摘要</button></div>
        <div className="health-doctor-list">{(activeMember ? [activeMember] : data.members).map(member => <article key={member.id}><Stethoscope size={23} /><div><h3>{member.name}的医疗联系</h3><p>{text(member.doctor)} · {text(member.hospital)}</p><p>{text(member.doctorContact)}</p></div><button className="icon-button" title="编辑医疗联系" onClick={() => openEditor('members', member)}><Pencil size={16} /></button></article>)}</div>
        <div className="health-section-head health-section-divider"><div><h2>一张完整药单</h2><p>药名、浓度、每次用量与时间照医嘱填写。漏服处理询问医生或药师，不统一补双倍。</p></div>{addButton('medications')}</div>
        <div className="health-table-wrap"><table><caption>处方药、非处方药与补充剂</caption><thead><tr><th>成员 / 通用名</th><th>规格 / 每次剂量</th><th>频次与用途</th><th>医生 / 核对日期</th><th>注意事项</th><th>操作</th></tr></thead><tbody>{filtered(data.medications).map(row => <tr key={row.id}><td>{memberName(row.memberId)}<strong>{row.name}</strong></td><td>{text(row.strength)}<small>{text(row.dose)}</small></td><td>{text(row.schedule)}<small>{text(row.purpose)}</small></td><td>{text(row.prescriber)}<small>{row.reviewDate || '日期未记录'}</small></td><td>{text(row.notes)}</td><td>{recordTools('medications', row)}</td></tr>)}</tbody></table></div>
        {!filtered(data.medications).length && <div className="health-empty">未录入药物，不代表未用药。就医、出院或换药后核对一次完整药单。</div>}
        <div className="health-section-head health-section-divider"><div><h2>预约、结果与下一次安排</h2><p>预防接种、筛查、复诊和报告异常都可以登记。筛查种类与频率由年龄、风险和医生建议决定。</p></div>{addButton('visits')}</div>
        <div className="health-visit-list">{filtered(data.visits).sort((a, b) => b.date.localeCompare(a.date)).map(row => <article key={row.id}><header><div><span className="health-chip">{row.status === 'planned' ? '已安排' : row.status === 'waiting' ? '待结果' : '已完成'}</span><h3>{row.reason}</h3><p>{memberName(row.memberId)} · {row.date} · {row.institution}</p></div>{recordTools('visits', row)}</header><dl><dt>想问医生</dt><dd>{text(row.questions)}</dd><dt>结果与下一步</dt><dd>{text(row.outcome)}</dd><dt>下次日期</dt><dd>{row.nextDate || '尚待确认'}</dd></dl></article>)}</div>
        {!filtered(data.visits).length && <div className="health-empty">暂无就医事项。已有预约时可先记日期和最想问的问题。</div>}
      </>}
      {view === 'guide' && <>
        <div className="health-section-head"><div><h2>家庭健康工具箱</h2><p>通用科学参考与家庭管理设计分开使用；特殊人群和个人目标请与负责医生确认。</p></div></div>
        <div className="health-guide-layout"><nav aria-label="健康指南文档">{guideDocs.map(doc => <button key={doc.id} aria-current={guide?.id === doc.id ? 'page' : undefined} onClick={() => setGuideId(doc.id)}><BookOpen size={16} />{doc.title}</button>)}</nav><div className="health-guide-document">{guide ? <><h2>{guide.title}</h2><ContentBody content={guide} /></> : <p>健康指南正在准备。</p>}</div></div>
      </>}
      <details className="health-emergency"><summary><HeartPulse size={18} />遇到急症，先行动</summary><div><p>持续胸痛、明显呼吸困难、意识异常、突然口角歪斜或肢体无力、严重出血，以及有自伤危险等情况，立即寻求急救，不等待记录或系统判断。儿童、孕产妇和老人有明显异常时及时联系医疗机构。</p><a className="button health-emergency-button" href="tel:120"><Phone size={16} />拨打120</a><p>一次读数不能确诊或决定用药；不要据此自行加药、停药或改剂量。</p></div></details>
      <footer className="health-footer"><p>本账号私有工作区 · 不自动向外部AI发送健康数据 · 提醒仅在本页清单呈现</p><div><button className="back-link" disabled={busy} onClick={() => exportData(data)}><Download size={15} />导出备份</button><button className="back-link health-delete" disabled={busy || conflict} onClick={() => void clearWorkspace()}><Trash2 size={15} />清除本账号资料</button></div></footer>
    </>}
    {editor && <div className="health-modal-backdrop"><section className="health-modal" role="dialog" aria-modal="true" aria-labelledby="health-editor-title"><header><h2 id="health-editor-title">{data[editor.kind].some(row => row.id === editor.value.id) ? '编辑' : '新增'}{kindTitles[editor.kind]}</h2><button className="icon-button" title="关闭表单" disabled={busy} onClick={() => setEditor(null)}><X size={20} /></button></header><form onSubmit={saveEditor}>
      <HealthForm editor={editor} members={data.members} onChange={(key, value) => setEditor(previous => previous ? { ...previous, value: { ...previous.value, [key]: value } } : null)} />
      {error && <p className="health-message error" role="alert">{error}</p>}
      <div className="health-form-actions"><button className="button" disabled={busy || conflict} type="submit"><Check size={16} />{busy ? '保存中…' : '保存'}</button><button type="button" className="button secondary" disabled={busy} onClick={() => setEditor(null)}>取消</button></div>
    </form></section></div>}
    {summaryPerson && <div className="health-modal-backdrop"><section className="health-modal health-summary-modal" role="dialog" aria-modal="true" aria-labelledby="health-summary-title"><header><h2 id="health-summary-title">{summaryPerson.name}的就诊摘要</h2><button className="icon-button" title="关闭摘要" onClick={() => setSummaryMember(null)}><X size={20} /></button></header><label>摘要成员<select value={summaryPerson.id} onChange={event => setSummaryMember(event.target.value)}>{data.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><p className="health-caption">摘要包含私人健康信息，仅交给本人授权的家人或负责医生。</p><div className="health-summary-actions"><button className="button" onClick={() => window.print()}><Printer size={16} />打印摘要</button><button className="button secondary" onClick={() => downloadFile(selectedSummary, 'text/plain;charset=utf-8', `health-summary-${today}.txt`)}><Download size={16} />下载文本</button></div><pre className="health-print-summary">{selectedSummary}</pre></section></div>}
  </section>;
}

function HealthForm({ editor, members, onChange }: { editor: Editor; members: HealthMember[]; onChange: (key: string, value: string | number | boolean | null) => void }) {
  const draft = editor.value as unknown as Record<string, string | number | boolean | null>;
  const value = (key: string) => typeof draft[key] === 'number' && !Number.isFinite(draft[key]) ? '' : String(draft[key] ?? '');
  const field = (key: string, label: string, options: { required?: boolean; type?: string; maxLength?: number; min?: number | string; max?: number | string; step?: string; wide?: boolean } = {}) => <label key={key} className={options.wide ? 'wide' : undefined}>{label}<input value={value(key)} required={options.required} type={options.type || 'text'} maxLength={options.maxLength || 4000} min={options.min} max={options.max} step={options.step} onChange={event => onChange(key, options.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} /></label>;
  const area = (key: string, label: string, required = false) => <label key={key} className="wide">{label}<textarea rows={3} maxLength={4000} required={required} value={value(key)} onChange={event => onChange(key, event.target.value)} /></label>;
  const select = (key: string, label: string, choices: Array<[string, string]>) => <label key={key}>{label}<select value={value(key)} onChange={event => {
    onChange(key, event.target.value);
    if (key === 'kind') { onChange('value', ''); onChange('secondary', event.target.value === 'bloodPressure' ? '' : null); }
  }}>{choices.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>;
  const date = (key: string, label: string, required = false) => field(key, label, { type: 'date', required });
  return <div className="health-form-grid">
    {editor.kind !== 'members' && select('memberId', '所属成员', members.map(member => [member.id, member.name]))}
    {editor.kind === 'members' && <>
      {field('name', '姓名 / 昵称', { required: true, maxLength: 80 })}{field('birthDate', '出生日期', { type: 'date', max: healthToday() })}{field('relationship', '家庭关系', { maxLength: 80 })}
      {select('management', '家庭管理状态', Object.entries(managementNames))}
      {area('conditions', '医生确诊病史与重要变化')}{area('allergies', '过敏物及具体反应')}{field('emergencyContact', '紧急联系人及电话')}
      {field('doctor', '家庭医生 / 负责医生')}{field('hospital', '社区 / 医疗机构')}{field('doctorContact', '医生联系与可联系时段')}
      {area('goals', '最希望解决的问题与当前目标')}{area('monitoringPlan', '医生确认的监测计划与异常应对')}
      <label className="health-check wide"><input type="checkbox" required checked={Boolean(draft.consent)} onChange={event => onChange('consent', event.target.checked)} />本人同意记录，或由有权监护人确认管理</label>
      <p className="health-caption wide">管理状态用于安排家庭照护，不是医学诊断。未知信息留空；明确无过敏时，请写明核对日期。</p>
    </>}
    {editor.kind === 'measurements' && <>
      {select('kind', '记录项目', Object.entries(measurementKinds).map(([key, item]) => [key, item.label]))}
      {field('measuredAt', '记录时间', { type: 'datetime-local', required: true })}
      {field('value', draft.kind === 'bloodPressure' ? '收缩压（mmHg）' : `数值（${measurementKinds[draft.kind as MeasurementKind].unit}）`, { type: 'number', required: true, min: measurementKinds[draft.kind as MeasurementKind].min, max: measurementKinds[draft.kind as MeasurementKind].max, step: 'any' })}
      {draft.kind === 'bloodPressure' && field('secondary', '舒张压（mmHg）', { type: 'number', required: true, min: 20, max: 200, step: 'any' })}
      {select('source', '数据来源', [['self', '本人记录'], ['device', '设备读数'], ['clinic', '医疗机构']])}
      {area('context', '测量条件（如时间、姿势、餐前餐后）')}{area('note', '不适、变化与备注')}
      <p className="health-caption wide">只记录原始事实；录入范围不是正常值范围。血糖保留餐前餐后，血压保留休息、姿势和复测背景。</p>
    </>}
    {editor.kind === 'actions' && <>
      {field('title', '行动内容', { required: true, maxLength: 160 })}{select('category', '行动类别', Object.entries(categoryNames))}
      {field('owner', '责任人', { required: true, maxLength: 80 })}{date('dueDate', '截止日期', true)}{select('status', '行动状态', Object.entries(actionStates))}
      {select('recurrence', '重复安排', [['none', '不重复'], ['daily', '每天'], ['weekly', '每周']])}
      <label className="health-check"><input type="checkbox" checked={Boolean(draft.focus)} onChange={event => onChange('focus', event.target.checked)} />设为阶段重点（每人最多三项未完成）</label>
      {area('evidence', '完成结果 / 凭证 / 下一步', draft.status === 'done')}{area('obstacle', '执行困难与需要的帮助')}
      <p className="health-caption wide">重复行动首次完成并记录结果后，创建下一期；若已逾期，从今天往后安排，不补造历史打卡。此页不会发送后台通知。</p>
    </>}
    {editor.kind === 'medications' && <>
      {field('name', '药物通用名 / 补充剂名称', { required: true, maxLength: 160 })}{field('strength', '规格 / 浓度')}{field('dose', '每次剂量（照医嘱）')}
      {field('schedule', '频次与服用时间')}{field('purpose', '用途 / 适应证')}{field('prescriber', '开方医生 / 药师')}{date('reviewDate', '下次核对日期')}{area('notes', '注意事项、余量与医嘱原文')}
      <p className="health-caption wide">核对后在注意事项中记下结果，更新下次核对日期；没有后续安排时清空日期，即从今日清单移除。</p>
      <p className="health-caption wide">不确定剂量或漏服怎么办时先联系医生/药师，不能据此自行停换药。儿童液体药需核对具体浓度与量具。</p>
    </>}
    {editor.kind === 'visits' && <>
      {date('date', '就医 / 检查日期', true)}{field('institution', '医生 / 医疗机构', { required: true })}{field('reason', '主要问题 / 检查事项', { required: true })}
      {select('status', '就医状态', [['planned', '已安排'], ['waiting', '待结果'], ['done', '已完成']])}{date('nextDate', '下次复诊 / 复查日期')}
      {area('questions', '最想问医生的问题')}{area('outcome', '诊断或待排问题、结果与下一步', draft.status === 'done')}
      <p className="health-caption wide">已完成就医仍有下次日期时，到期会进入今日清单；完成复诊后更新结果并改为下一次日期，没有后续安排时清空日期。</p>
    </>}
    {editor.kind === 'reviews' && <>
      {date('date', '回顾日期', true)}{area('changes', '本周有什么变化？', true)}{area('support', '谁需要什么帮助？')}{area('nextSteps', '下周最重要的事和责任人')}{area('simplify', '哪些记录或提醒可以减少？')}
    </>}
  </div>;
}
