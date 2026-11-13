import { useState } from "react";
import { ArrowLeft, ArrowRight, Clipboard, Pencil, Save, UserRound } from "lucide-react";
import type { Content, Role } from "./types";
import { api } from "./api";
import { ContentBody, ErrorMessage } from "./components";
import { learningBasicsDocument, learningBasicsFolder, learningScope, planningReference, scopeGuidance } from "./learningBasicsModel";
import "./learningBasics.css";

export function LearningBasics({ project, role, onBack, onOpen, onSaved }: {
  project: Content; role: Role; onBack: () => void; onOpen: (content: Content) => void; onSaved: () => Promise<void>;
}) {
  const document = learningBasicsDocument(project);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(document?.description || "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!document || busy) return;
    setBusy(true); setError("");
    try {
      const latest = await api<Content>(`/contents/${document.id}`);
      if (latest.updatedAt !== document.updatedAt) throw new Error("基本信息已在其他页面更新。请先保留当前文字，再刷新核对后编辑。");
      const { title, type, scene, parentId, sortOrder, coverUrl, fileUrl, hlsUrl, pdfUrl } = latest;
      await api(`/contents/${document.id}`, { method: "PUT", body: JSON.stringify({ title, type, scene, parentId, sortOrder,
        coverUrl, fileUrl, hlsUrl, pdfUrl, topics: latest.topics || ["family", "planning"],
        imagesJson: latest.imagesJson || [], assetsJson: latest.assetsJson || [], description: draft }) });
      setEditing(false);
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <section className="learning-basics" aria-label="基本信息">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> 返回{project.title}</button>
    <header className="learning-basics-heading"><div><p className="eyebrow">LEARNING FOUNDATION</p><h1><UserRound size={28} />基本信息</h1>
      <p>先了解基础、兴趣、目标和可用时间，再安排通识、专业与运动。</p></div>
      {role === "admin" && document && !editing && <button className="button" onClick={() => { setDraft(document.description); setEditing(true); setPreview(false); setError(""); }}><Pencil size={16} />编辑基本信息</button>}
    </header>
    <p className="learning-basics-visibility">本项目已授权成员可见，仅填写安排所需信息。未填写的内容保持待确认。</p>
    <ErrorMessage message={error} />
    {!document ? <p>基本信息文档尚未建立，请由管理员初始化此板块。</p> : editing ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="learning-basics-editor">基本信息正文<textarea required maxLength={100000} rows={24} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} /></label>
      <div className="learning-basics-actions"><button className="button primary" type="submit" disabled={busy || !draft.trim()}><Save size={16} />{busy ? "正在保存…" : "保存基本信息"}</button>
        <button className="button" type="button" disabled={busy} onClick={() => setPreview(value => !value)}>{preview ? "收起预览" : "预览"}</button>
        <button className="button" type="button" disabled={busy} onClick={() => { if (draft === document.description || window.confirm("放弃尚未保存的基本信息修改？")) { setEditing(false); setError(""); } }}>取消</button></div>
      {preview && <article><ContentBody content={{ ...document, description: draft }} /></article>}
    </form> : <article><ContentBody content={document} /></article>}
    <nav className="learning-basics-sections" aria-label="依据基本信息进入板块">{project.children?.filter(section => ["通识", "专业", "运动"].includes(section.title)).map(section =>
      <button className="button" key={section.id} onClick={() => onOpen(section)}>{section.title}<ArrowRight size={16} /></button>)}</nav>
  </section>;
}

export function LearningReference({ project, target, onOpen }: { project: Content; target?: Content | null; onOpen: (content: Content) => void }) {
  const folder = learningBasicsFolder(project);
  const document = learningBasicsDocument(project);
  const [expanded, setExpanded] = useState(false);
  const [copyText, setCopyText] = useState("");
  const [notice, setNotice] = useState("");
  const scope = learningScope(project, target);
  async function copy() {
    const value = planningReference(project, target);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value); setNotice("已复制当前基本信息与安排要求。"); setCopyText("");
    } catch { setCopyText(value); setNotice("安排依据已展开，可长按文字选择复制。"); }
  }
  return <aside className="learning-reference" aria-label="基本信息参考">
    <div className="learning-reference-heading"><UserRound size={18} /><strong>以基本信息为安排依据</strong>
      {folder && <button className="back-link" onClick={() => onOpen(folder)}>查看基本信息<ArrowRight size={15} /></button>}</div>
    <p>{scopeGuidance[scope] || "先核对学习者的基础、目标与时间，再选择内容与安排任务。"}</p>
    {document ? <>
      <div className="learning-reference-actions"><button className="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "收起参考信息" : "展开参考信息"}</button>
        <button className="button" onClick={() => void copy()}><Clipboard size={15} />复制安排依据</button>
        <span>更新于 {new Date(document.updatedAt).toLocaleDateString("zh-CN")}</span></div>
      {expanded && <article><ContentBody content={document} /></article>}
      {notice && <p role="status">{notice}</p>}
      {copyText && <textarea className="learning-reference-copy" aria-label="安排依据" readOnly rows={10} value={copyText} onFocus={event => event.target.select()} />}
    </> : <p>基本信息尚未建立，先确认学习者的条件，不推断个人信息。</p>}
  </aside>;
}
