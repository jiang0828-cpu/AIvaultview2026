import { createElement, type CSSProperties, type ReactNode } from 'react';
import type { PageNode, PageSnapshot } from './shareSnapshot';

function renderNode(node: PageNode, key: number): ReactNode {
  if (typeof node === 'string') return node;
  const { style: css, ...attrs } = node.attrs;
  const style: CSSProperties = {};
  for (const declaration of (css || '').split(';').filter(Boolean)) {
    const separator = declaration.indexOf(':');
    const name = declaration.slice(0, separator).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    Object.assign(style, { [name]: declaration.slice(separator + 1) });
  }
  const props = { ...attrs, key, ...(css ? { style } : {}),
    ...(node.tag === 'a' ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    ...(['video', 'audio'].includes(node.tag) ? { controls: true, preload: 'metadata' } : {}),
    ...(node.tag === 'details' ? { open: true } : {}) };
  if (['img', 'br', 'hr', 'source'].includes(node.tag)) return createElement(node.tag, props);
  return createElement(node.tag, props, ...node.children.map(renderNode));
}

export function SnapshotPage({ page }: { page: PageSnapshot }) {
  return <section className="share-snapshot">
    <header className="share-snapshot-heading"><h1>{page.title}</h1><p>页面快照 · {new Date(page.capturedAt).toLocaleString('zh-CN')} · 只读</p></header>
    <div className="share-snapshot-body">{page.nodes.map(renderNode)}</div>
  </section>;
}
