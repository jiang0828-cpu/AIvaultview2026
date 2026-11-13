import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, KeyRound, Plus, Save, ShieldCheck, UserRound, ArrowLeft } from 'lucide-react';
import { api } from './api';
import { Brand, ErrorMessage } from './components';
import type { Role, SessionUser } from './types';
import './accounts.css';

type ManagedUser = SessionUser & { enabled: boolean; createdAt: string; updatedAt: string };
type Project = { id: number; title: string; scene: string };
const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试';

export function PasswordChange({ forced = false, onChanged }: { forced?: boolean; onChanged: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword'));
    if (newPassword !== form.get('confirmPassword')) { setError('两次输入的新密码不一致'); return; }
    setBusy(true); setError('');
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: form.get('oldPassword'), newPassword }) });
      onChanged();
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <section className={`password-page ${forced ? 'password-page-forced' : ''}`}>
    {forced && <Brand />}
    <div className="account-heading"><KeyRound size={22} /><h1>{forced ? '首次登录 · 设置新密码' : '修改密码'}</h1></div>
    <p className="muted">{forced ? '临时密码仅用于首次登录。' : ''}修改后需重新登录，其他设备的登录也会失效。</p>
    <form className="account-form" onSubmit={submit}>
      <label>原密码<input name="oldPassword" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <label>新密码<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
      <label>确认新密码<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
      <p className="muted">至少 12 个字符，最多 72 个 UTF-8 字节。</p>
      <ErrorMessage message={error} />
      <button className="button primary" disabled={busy}><Save size={16} />{busy ? '保存中…' : '保存并重新登录'}</button>
    </form>
    {forced ? <button type="button" className="button" onClick={async () => {
      try { await api('/auth/logout', { method: 'POST', body: '{}' }); onChanged(); }
      catch (error) { setError(messageOf(error)); }
    }}>退出登录</button> : <Link className="button" to="/home"><ArrowLeft size={16} />返回空间</Link>}
  </section>;
}

export function Accounts({ currentUser }: { currentUser: SessionUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  async function reload() {
    const [nextUsers, nextProjects] = await Promise.all([
      api<ManagedUser[]>('/admin/users'), api<Project[]>('/admin/projects'),
    ]);
    setUsers(nextUsers); setProjects(nextProjects);
  }
  useEffect(() => {
    void reload().catch(error => setError(messageOf(error))).finally(() => setLoading(false));
  }, []);
  const selected = users.find(user => user.id === selectedId);
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !row) return;
    const reveal = () => {
      const rowBounds = row.getBoundingClientRect();
      const listBounds = list.getBoundingClientRect();
      if (rowBounds.bottom > listBounds.bottom) list.scrollTop += rowBounds.bottom - listBounds.bottom;
      else if (rowBounds.top < listBounds.top) list.scrollTop -= listBounds.top - rowBounds.top;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(list);
    return () => observer.disconnect();
  }, [selectedId, users]);
  return <section className="accounts-page">
    <div className="page-heading"><div><p className="eyebrow">同路人 · ACCESS</p><h1>用户与授权</h1></div>
      <button className="button primary" onClick={() => { setSelectedId(null); setNotice(''); }}><Plus size={17} />创建账号</button></div>
    <ErrorMessage message={error} />
    {notice && <p className="account-notice" role="status"><Check size={16} />{notice}</p>}
    {loading ? <p className="muted">正在读取账号…</p> : <div className="accounts-layout">
      <div ref={listRef} className="accounts-list" aria-label="账号列表">
        {users.map(user => <button key={user.id} type="button" aria-pressed={selectedId === user.id}
          className={`account-row ${selectedId === user.id ? 'selected' : ''}`} onClick={() => { setSelectedId(user.id); setNotice(''); }}>
          {user.role === 'admin' ? <ShieldCheck size={18} /> : <UserRound size={18} />}
          <span><strong>{user.username}</strong><small>{user.role === 'admin' ? '管理员' : user.role === 'share' ? '分享浏览' : '访问者'}{user.id === currentUser.id ? ' · 当前账号' : ''}</small></span>
          <span className={`account-status ${user.enabled ? '' : 'disabled'}`}>{user.enabled ? '启用' : '停用'}</span>
        </button>)}
      </div>
      <AccountEditor key={selectedId ?? 'new'} user={selected} projects={projects} currentUser={currentUser}
        onSaved={async (text, id) => { await reload(); if (id) setSelectedId(id); setNotice(text); }} />
    </div>}
  </section>;
}

function AccountEditor({ user, projects, currentUser, onSaved }: {
  user?: ManagedUser; projects: Project[]; currentUser: SessionUser;
  onSaved: (notice: string, id?: number) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>(user?.role || 'visitor');
  const [grants, setGrants] = useState<number[]>([]);
  const [researchEditors, setResearchEditors] = useState<number[]>([]);
  const [grantsReady, setGrantsReady] = useState(!user);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void api<{ projectIds: number[]; researchEditorProjectIds: number[] }>(`/admin/users/${user.id}/projects`).then(data => {
      if (active) { setGrants(data.projectIds); setResearchEditors(data.researchEditorProjectIds); setGrantsReady(true); }
    }).catch(error => { if (active) setError(messageOf(error)); });
    return () => { active = false; };
  }, [user?.id]);
  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const saved = await api<ManagedUser>(user ? `/admin/users/${user.id}` : '/admin/users', {
        method: user ? 'PATCH' : 'POST', body: JSON.stringify({ username: form.get('username'), role,
          ...(user ? { enabled: form.get('enabled') === 'on' } : { password: form.get('password') }) }),
      });
      if (user?.id === currentUser.id && (saved.username !== user.username || saved.role !== user.role || !saved.enabled)) {
        window.dispatchEvent(new Event('session-expired')); return;
      }
      await onSaved(user ? '账号已保存' : '账号已创建，请分配项目并将临时密码交给使用者。', saved.id);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <div className="account-editor">
    <h2>{user ? user.username : '创建账号'}</h2>
    <ErrorMessage message={error} />
    <form className="account-form" onSubmit={saveAccount}>
      <label>用户名<input name="username" autoComplete="off" defaultValue={user?.username || ''} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" /></label>
      <label>角色<select value={role} onChange={event => setRole(event.target.value as Role)}><option value="visitor">访问者</option><option value="share">分享浏览</option><option value="admin">管理员</option></select></label>
      {user ? <label className="account-check"><input name="enabled" type="checkbox" defaultChecked={user.enabled} />启用账号</label>
        : <label>{role === 'share' ? '分享密码' : '临时密码'}<input name="password" type="password" autoComplete="new-password" required minLength={role === 'share' ? 6 : 12} maxLength={72} /></label>}
      <button className="button primary" disabled={busy}><Save size={16} />{busy ? '保存中…' : user ? '保存账号' : '创建账号'}</button>
    </form>
    {user && <section className="account-section">
      <h3>项目浏览与下载权限</h3>
      {user.role === 'admin' ? <p className="muted">管理员可管理全部项目。</p> : <form onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('');
        try { await api(`/admin/users/${user.id}/projects`, { method: 'PUT', body: JSON.stringify({ projectIds: grants, researchEditorProjectIds: researchEditors.filter(id => grants.includes(id)) }) }); await onSaved('项目授权已保存，下一次请求即生效。'); }
        catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
      }}>
        <fieldset disabled={busy || !grantsReady} className="project-grants">
          <legend className="muted">未勾选的项目对该账号不可见</legend>
          {projects.map(project => <div key={project.id}><label className="account-check"><input type="checkbox"
            checked={grants.includes(project.id)} onChange={event => setGrants(previous => event.target.checked ? [...previous, project.id] : previous.filter(id => id !== project.id))} />{project.title}</label>
            {user.role !== 'share' && grants.includes(project.id) && <label className="account-check"><input type="checkbox" checked={researchEditors.includes(project.id)}
              onChange={event => setResearchEditors(previous => event.target.checked ? [...previous, project.id] : previous.filter(id => id !== project.id))} />允许编辑该项目的调研任务</label>}
          </div>)}
          {!projects.length && <p className="muted">尚未创建项目。</p>}
        </fieldset>
        <button className="button" disabled={busy || !grantsReady}><ShieldCheck size={16} />保存项目授权</button>
      </form>}
    </section>}
    {user && user.id !== currentUser.id && <section className="account-section">
      <h3>重置临时密码</h3>
      <form className="account-form" onSubmit={async event => {
        event.preventDefault(); const element = event.currentTarget; const form = new FormData(element);
        setBusy(true); setError('');
        try { await api(`/admin/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: form.get('password') }) });
          element.reset(); await onSaved(user.role === 'share' ? '分享密码已重置，原会话已退出。' : '临时密码已重置，原会话已退出，下次登录需改密。'); }
        catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
      }}>
        <label>{user.role === 'share' ? '新分享密码' : '新临时密码'}<input name="password" type="password" autoComplete="new-password" required minLength={user.role === 'share' ? 6 : 12} maxLength={72} /></label>
        <button className="button" disabled={busy}><KeyRound size={16} />重置密码</button>
      </form>
    </section>}
  </div>;
}
