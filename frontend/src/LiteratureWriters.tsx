import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Search, RotateCcw, BookOpen } from 'lucide-react';
import { api } from './api';
import { filterWriters, literaryRegions, type WriterProfile } from './writers';

const pageSize = 24;
export function LiteratureWriters({ writers, loading, error, onRetry, projectId }: {
  writers: WriterProfile[]; loading: boolean; error: string; onRetry: () => void; projectId: number;
}) {
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get('q') || '', country: params.get('country') || '', era: params.get('era') || '',
    genre: params.get('genre') || '', topic: params.get('topic') || '', sort: params.get('sort') || 'name' };
  const matches = filterWriters(writers, filters);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const rawPage = Number(params.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, pages) : 1;
  const selectedId = params.get('writer');
  const selected = writers.find((writer) => writer.id === selectedId);
  const update = (values: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next, { replace });
  };
  useEffect(() => {
    if (selected) void api('/log', { method: 'POST', body: JSON.stringify({ contentId: projectId, action: 'view_text' }) }).catch(() => {});
  }, [selected, projectId]);
  if (loading) return <div className="literature-empty" role="status">正在载入人物档案…</div>;
  if (error) return <div className="literature-empty" role="alert"><p>{error}</p><button className="button" onClick={onRetry}><RotateCcw size={16} />重试</button></div>;
  const backToList = () => { const next = new URLSearchParams(params); next.delete('writer'); setParams(next); };
  if (selectedId && !selected) return <div className="literature-empty"><h2>未找到该人物</h2><button className="text-link" onClick={backToList}><ArrowLeft size={16} />返回人物索引</button></div>;
  if (selected) return <article className="writer-profile">
    <button className="text-link" onClick={backToList}><ArrowLeft size={16} />返回人物索引</button>
    <header className="writer-profile-heading"><div className="writer-monogram" aria-hidden="true">{selected.name.slice(0, 1)}</div><div>
      <p className="literature-kicker">{literaryRegions.find((region) => region.code === selected.country)?.name} / {selected.era}</p>
      <h2>{selected.name}</h2><p className="writer-original">{selected.originalName}</p><p>{selected.dates}</p>
      <div className="writer-tags">{selected.topics.map((topic) => <button key={topic} onClick={() => update({ writer: '', country: '', era: '', genre: '', q: '', topic })}>{topic}</button>)}</div>
    </div></header>
    <p className="writer-lead">{selected.summary}</p>
    <p className="writer-context">{selected.context}</p>
    <div className="writer-review"><span>{selected.reviewStatus}</span><span>资料核对：{selected.checkedAt}</span></div>
    <nav className="writer-anchors" aria-label="人物档案目录">{[['life', '生平'], ['works', '代表作品'], ['timeline', '时间线'], ['style', '文学特色'], ['reading', '阅读路线'], ['sources', '考证与来源']].map(([id, label]) => <a key={id} href={`#writer-${id}`}>{label}</a>)}</nav>
    <section id="writer-life" className="writer-section"><h3>生平与时代</h3><p>{selected.biography}</p></section>
    <section id="writer-works" className="writer-section"><h3>代表作品</h3><div className="writer-works">{selected.works.map((work) => <div key={work.title}><div><h4>{work.title}</h4><span>{work.date}</span></div><p>{work.note}</p></div>)}</div></section>
    <section id="writer-timeline" className="writer-section"><h3>生平与文本时间线</h3><ol className="writer-timeline">{selected.timeline.map((event, index) => <li key={index}><strong>{event.date}</strong><p>{event.event}</p></li>)}</ol></section>
    <section id="writer-style" className="writer-section"><h3>文学特色与意义</h3><p>{selected.significance}</p><div className="writer-genres">{selected.genres.map((genre) => <span key={genre}>{genre}</span>)}</div></section>
    <section id="writer-reading" className="writer-section"><h3>阅读路线 <small>编辑建议</small></h3><p>{selected.reading}</p></section>
    <section id="writer-sources" className="writer-section"><h3>考证与来源</h3><p className="writer-caution">{selected.cautions}</p><ul className="writer-sources">{selected.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={14} /></a><p>{source.scope}</p></li>)}</ul><p className="literature-source-note">档案为原创中文整理与阅读导引，非作品全文。来源支持范围见各条说明；文学评价为编辑综合，尚未经过人工双审。古典原作、现代译本及影像的权利状态分别判断。</p></section>
  </article>;

  return <section className="literature-section">
    <div className="literature-section-heading"><div><p className="literature-kicker">A WRITER'S ATLAS</p><h2>文学人物索引</h2></div><span className="literature-muted">已收录 {writers.length} 位 · 8 个文学地域</span></div>
    <div className="literature-country-grid">{literaryRegions.map((region) => <button key={region.code} aria-pressed={filters.country === region.code} className={filters.country === region.code ? 'active' : ''} onClick={() => update({ country: filters.country === region.code ? '' : region.code })}><span>{region.en}</span><strong>{region.name}</strong><small>{region.theme}</small><span className="literature-index-status">{writers.filter((writer) => writer.country === region.code).length} 位人物<ArrowRight size={14} /></span></button>)}</div>
    <label className="literature-doc-search writer-search"><Search size={17} /><input aria-label="检索人物" placeholder="姓名、原文名、作品、主题" value={filters.q} onChange={(event) => update({ q: event.target.value }, true)} /></label>
    <div className="literature-index-filters writer-filters">
      <label>时代<select aria-label="人物时代" value={filters.era} onChange={(event) => update({ era: event.target.value })}><option value="">全部时代</option>{[...new Set(writers.map((writer) => writer.era))].map((era) => <option key={era}>{era}</option>)}</select></label>
      <label>文学类型<select aria-label="文学类型" value={filters.genre} onChange={(event) => update({ genre: event.target.value })}><option value="">全部类型</option>{['诗歌与抒情', '小说与叙事', '戏剧与舞台', '散文与思想'].map((genre) => <option key={genre}>{genre}</option>)}</select></label>
      <label>内容标签<select aria-label="人物标签" value={filters.topic} onChange={(event) => update({ topic: event.target.value })}><option value="">全部标签</option>{[...new Set(writers.flatMap((writer) => writer.topics))].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((topic) => <option key={topic}>{topic}</option>)}</select></label>
      <label>排序<select aria-label="人物排序" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}><option value="name">姓名</option><option value="birth">出生年代 · 早到晚</option></select></label>
      <button className="text-link" onClick={() => setParams({ project: String(projectId), view: 'index' })}><RotateCcw size={14} />重置条件</button>
    </div>
    <div className="writer-result-count" role="status">{matches.length} 位人物{filters.country ? ` / ${literaryRegions.find((region) => region.code === filters.country)?.name || filters.country}` : ''}</div>
    <div className="writer-grid">{matches.slice((page - 1) * pageSize, page * pageSize).map((writer) => <button className="writer-card" key={writer.id} onClick={() => { const next = new URLSearchParams(params); next.set('writer', writer.id); setParams(next); window.scrollTo({ top: 0, behavior: 'instant' }); }}>
      <div className="writer-card-top"><span className="writer-avatar" aria-hidden="true">{writer.name.slice(0, 1)}</span><span>{writer.era}<br />{writer.dates}</span><ArrowRight size={16} /></div>
      <h3>{writer.name}</h3><p className="writer-original">{writer.originalName}</p><p className="writer-card-summary">{writer.summary}</p><p className="writer-card-work"><BookOpen size={14} />{writer.works[0].title}</p><div className="writer-tags">{writer.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
    </button>)}</div>
    {!matches.length && <div className="literature-empty"><Search size={28} /><h3>没有符合条件的人物</h3><p>当前检索与筛选结果为 0 位。</p></div>}
    {matches.length > 0 && <nav className="writer-pagination" aria-label="人物分页"><button className="icon-button" title="上一页" aria-label="上一页" disabled={page === 1} onClick={() => update({ page: String(page - 1) })}><ChevronLeft size={18} /></button><span>第 {page} / {pages} 页</span><button className="icon-button" title="下一页" aria-label="下一页" disabled={page === pages} onClick={() => update({ page: String(page + 1) })}><ChevronRight size={18} /></button></nav>}
    <p className="literature-source-note">文学地域为索引分组，不等同于现代国籍。具体历史身份、生卒争议、书目版本与来源见人物档案。</p>
  </section>;
}
