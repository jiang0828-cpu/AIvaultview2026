import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Download, Feather, FileText, Globe2, Search, ShieldCheck } from 'lucide-react';
import { ContentBody, TopicPills } from './components';
import { api } from './api';
import { flatten, type Content } from './types';
import { LiteratureWriters } from './LiteratureWriters';
import { literaryRegions as countries, type WriterProfile } from './writers';
import './literature.css';

const tabs = [
  { key: 'overview', label: '项目概览', Icon: Feather },
  { key: 'index', label: '文学索引', Icon: Globe2 },
  { key: 'documents', label: '项目文档', Icon: FileText },
  { key: 'roadmap', label: '建设路线', Icon: ShieldCheck },
];
const milestones = [
  { title: '建立项目空间', status: '本次建立', detail: '项目介绍、文学索引框架、原始资料归档与建设边界。', done: true },
  { title: '整理首批人物', status: '已建立', detail: '100 位人物的生平、书目、时间线、阅读建议与来源；争议单列。', done: true },
  { title: '接入人物展馆', status: '已接入', detail: '稳定 ID、检索、组合筛选、分页、独立档案与来源回溯。', done: true },
  { title: '人工复核与策展', status: '待人工复核', detail: '逐条人工双审与专题策展；现代译文、肖像和影像在授权后再接入。', done: false },
];

export function isLiteratureProject(project: Content) {
  return project.description.includes('<!-- LITERATURE_PROJECT -->');
}

export function LiteratureSpace({ project, onBack }: { project: Content; onBack: () => void }) {
  const [params, setParams] = useSearchParams();
  const view = tabs.some((tab) => tab.key === params.get('view')) ? params.get('view')! : 'overview';
  const docs = flatten(project.children || []).filter((item) => item.type !== 'folder');
  const activeDoc = docs.find((doc) => doc.id === Number(params.get('doc'))) || docs[0];
  const [writers, setWriters] = useState<WriterProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setWriters([]);
    void api<WriterProfile[]>(`/literature/${project.id}/writers`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setWriters(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '人物档案加载失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id, retry]);
  const [query, setQuery] = useState('');
  const lastLogged = useRef<number>();
  const navigate = (next: string, extra: Record<string, string> = {}) => {
    setParams({ project: String(project.id), view: next, ...extra });
  };
  const openDocument = (doc: Content) => navigate('documents', { doc: String(doc.id) });
  useEffect(() => {
    if (view !== 'documents' || !activeDoc || lastLogged.current === activeDoc.id) return;
    lastLogged.current = activeDoc.id;
    void api('/log', { method: 'POST', body: JSON.stringify({ contentId: activeDoc.id, action: 'view_text' }) }).catch(() => {});
  }, [view, activeDoc]);
  const filteredDocs = docs.filter((doc) => `${doc.title} ${doc.topics?.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="literature-space" aria-labelledby="literature-title">
      <div className="literature-topline">
        <button className="back-link" onClick={onBack}><ArrowLeft size={14} />空间概览</button>
        <span><Feather size={13} /> 兴趣爱好 / 文学策展</span>
      </div>
      <header className="literature-hero">
        <img src={project.coverUrl || '/media/projects/literature/library.jpg'} alt="图书馆的书架与藏书" />
        <div className="literature-hero-copy">
          <p>WORLD LITERATURE · A WRITER'S ATLAS</p>
          <h1 id="literature-title">文人墨客</h1>
          <span className="literature-subtitle">世界文学人物志</span>
          <p className="literature-intro">循着作家的足迹，走进作品与时代。<br />从一份档案开始，收藏值得重读的文学。</p>
          <div className="literature-hero-bottom"><span>文学百家 · 资料与策展空间</span><span className="literature-stage">{loading ? '档案载入中' : error ? '档案暂不可用' : `${writers.length} 位人物 · 资料核对版`}</span></div>
        </div>
      </header>
      <nav className="literature-tabs" aria-label="文人墨客空间导航">
        {tabs.map(({ key, label, Icon }) => <button key={key} aria-current={view === key ? 'page' : undefined} className={view === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={16} />{label}</button>)}
      </nav>

      {view === 'overview' && <>
        <div className="literature-stats">
          <div><strong>{String(docs.filter((doc) => doc.topics?.includes('source')).length).padStart(2, '0')}</strong><span>已归档来源文档</span></div>
          <div><strong>{String(countries.length).padStart(2, '0')}</strong><span>文学地域索引</span></div>
          <div><strong>{String(docs.length).padStart(2, '0')}</strong><span>项目资料</span></div>
          <div><strong>{loading || error ? '—' : writers.length}</strong><span>人物档案 · 待人工复核</span></div>
        </div>
        <section className="literature-opening">
          <div><p className="literature-kicker">ABOUT THE COLLECTION</p><h2>以人物为经，<br />以作品与时代为纬。</h2></div>
          <div><p>面向文学爱好者、学生教师与内容编辑，整理作家档案、代表作品与阅读线索。以“文学百家”产品为依据，先建立可追溯的资料基础，再逐步形成数字文学展馆。</p><p className="literature-source-note">依据：用户提供的两份文学百家 1.0 文档 · 2026.11.10</p></div>
        </section>
        <section className="literature-section">
          <div className="literature-section-heading"><div><p className="literature-kicker">EXPLORE THE ATLAS</p><h2>文学索引</h2></div><button className="text-link" onClick={() => navigate('index')}>全部索引<ArrowRight size={14} /></button></div>
          <div className="literature-country-strip">{countries.slice(0, 4).map((country) => <button key={country.code} onClick={() => navigate('index', { country: country.code })}><span>{country.en}</span><strong>{country.name}</strong><small>{country.theme}</small><ArrowRight size={15} /></button>)}</div>
        </section>
        <section className="literature-section">
          <div className="literature-section-heading"><div><p className="literature-kicker">READING ROOM</p><h2>项目资料室</h2></div><button className="text-link" onClick={() => navigate('documents')}>全部资料<ArrowRight size={14} /></button></div>
          <div className="literature-source-grid">{docs.filter((doc) => doc.topics?.includes('source')).map((doc) => <button className="literature-source-card" key={doc.id} onClick={() => openDocument(doc)}><FileText size={23} /><div><span>原始文档 · v1.0</span><h3>{doc.title.split('｜').slice(1).join('｜')}</h3><p>完整正文 / Word 原件</p></div><ArrowRight size={17} /></button>)}</div>
        </section>
        <div className="literature-integrity"><ShieldCheck size={18} /><p><strong>首批人物，逐条留存来源。</strong>本批次重新整理 100 位人物，不沿用旧文档中存在占位与错误映射的 97 条记录。生平、书目和争议均独立列示，状态为资料核对版，待人工复核。</p><button className="text-link" onClick={() => navigate('index')}>人物档案<ChevronRight size={14} /></button></div>
      </>}

      {view === 'index' && <LiteratureWriters writers={writers} loading={loading} error={error} onRetry={() => setRetry((value) => value + 1)} projectId={project.id} />}

      {view === 'documents' && <section className="literature-section">
        <div className="literature-section-heading"><div><p className="literature-kicker">PROJECT DOCUMENTS</p><h2>项目文档</h2></div><span className="literature-muted">原始说明与建设资料</span></div>
        <label className="literature-doc-search"><Search size={16} /><input aria-label="检索项目文档" placeholder="检索标题或标签" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="literature-document-list">{filteredDocs.map((doc) => <button key={doc.id} aria-pressed={doc.id === activeDoc?.id} className={doc.id === activeDoc?.id ? 'active' : ''} onClick={() => openDocument(doc)}><FileText size={15} />{doc.title.replace(/^\d+\s*/, '')}</button>)}{!filteredDocs.length && <p role="status">没有匹配的文档</p>}</div>
        {activeDoc ? <article className="literature-reader" key={activeDoc.id}>
          <div className="literature-reader-heading"><div><h3>{activeDoc.title.replace(/^\d+\s*/, '')}</h3><TopicPills topics={activeDoc.topics} /></div>{activeDoc.fileUrl && <a className="button" href={activeDoc.fileUrl} download><Download size={15} />Word 原件</a>}</div>
          <ContentBody content={activeDoc} />
        </article> : <div className="literature-empty">暂无项目文档</div>}
      </section>}

      {view === 'roadmap' && <section className="literature-section">
        <div className="literature-section-heading"><div><p className="literature-kicker">BUILD WITH EVIDENCE</p><h2>建设路线</h2></div><span className="literature-muted">空间先行 · 内容审校优先</span></div>
        <div className="literature-milestones">{milestones.map((stage, index) => <article key={stage.title}><span className={stage.done ? 'done' : ''}>{stage.done ? <Check size={18} /> : String(index + 1).padStart(2, '0')}</span><div><div className="literature-stage-heading"><h3>{stage.title}</h3><small>{stage.status}</small></div><p>{stage.detail}</p></div></article>)}</div>
        <div className="literature-review-band"><h3>内容边界与后续复核</h3><p>首批人物为重新整理的中文档案与阅读导引，不包含现代作品全文或未经授权肖像。原始项目文档保留为历史资料，不代表当前档案数量或已完成人工审核；原站技术修复仍需对应仓库验证。</p></div>
        <div className="literature-source-grid">{docs.filter((doc) => doc.title.startsWith('04 ') || doc.title.startsWith('05 ') || doc.title.startsWith('06 ')).map((doc) => <button className="literature-source-card" key={doc.id} onClick={() => openDocument(doc)}><BookOpen size={21} /><div><h3>{doc.title.replace(/^\d+\s*/, '')}</h3><p>建设依据与验收清单</p></div><ArrowRight size={16} /></button>)}</div>
      </section>}
      <footer className="literature-footer"><span>文人墨客 / 文学百家</span><span>首批人物档案 · 2026.11.10 · 待人工复核</span></footer>
    </section>
  );
}
