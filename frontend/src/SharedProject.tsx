import { useState } from 'react';
import { ArrowLeft, ChevronRight, FolderOpen, Search, ShieldCheck } from 'lucide-react';
import { ContentBody, TypeIcon, TopicPills } from './components';
import { flatten, type Content } from './types';

export function SharedProject({ items, rootId }: { items: Content[]; rootId: number }) {
  const all = flatten(items);
  const root = all.find(row => row.id === rootId)!;
  const [selectedId, setSelectedId] = useState(rootId);
  const [search, setSearch] = useState('');
  const selected = all.find(row => row.id === selectedId) || root;
  const path: Content[] = [selected];
  const seen = new Set([selected.id]);
  while (path[0].parentId && !seen.has(path[0].parentId)) {
    const parent = all.find(row => row.id === path[0].parentId);
    if (!parent) break;
    seen.add(parent.id); path.unshift(parent);
  }
  const matches = search.trim() ? all.filter(row => row.title.toLowerCase().includes(search.trim().toLowerCase())) : selected.children || [];
  function open(id: number) { setSelectedId(id); setSearch(''); window.scrollTo({ top: 0 }); }
  return <section className="shared-project" aria-label="分享项目资料">
    <header className="shared-project-heading"><div><p className="eyebrow">只读项目</p><h1>{root.title}</h1>
      <p className="muted"><ShieldCheck size={14} /> {all.filter(row => row.type !== 'folder').length} 份资料 · {all.filter(row => row.type === 'folder' && row.id !== rootId).length} 个目录</p></div>
      <label className="search-box"><Search size={17} /><input aria-label="搜索分享项目" placeholder="搜索项目内资料" value={search} onChange={event => setSearch(event.target.value)} /></label></header>
    <nav className="shared-project-path" aria-label="项目路径">{path.map((row, index) => <span key={row.id}>{index > 0 && <ChevronRight size={14} />}<button onClick={() => open(row.id)} aria-current={row.id === selected.id ? 'page' : undefined}>{row.title}</button></span>)}</nav>
    {selected.id !== rootId && <button className="button subtle" onClick={() => open(selected.parentId || rootId)}><ArrowLeft size={15} />返回目录</button>}
    {search || selected.type === 'folder' ? <>
      {!search && selected.description && <div className="shared-folder-description"><ContentBody content={{ ...selected, type: 'text', fileUrl: null, hlsUrl: null, pdfUrl: null, imagesJson: null }} /></div>}
      <div className="shared-project-grid">{matches.map(row => <button className="shared-project-item" key={row.id} onClick={() => open(row.id)}>
        <TypeIcon type={row.type} size={23} /><span><strong>{row.title}</strong><TopicPills topics={row.topics} /></span><ChevronRight size={17} /></button>)}</div>
      {!matches.length && <div className="empty"><FolderOpen size={30} /><p>{search ? '没有匹配资料' : '此目录暂无资料'}</p></div>}
    </> : <article className="share-content"><h2>{selected.title}</h2><TopicPills topics={selected.topics} /><ContentBody key={selected.id} content={selected} /></article>}
  </section>;
}
