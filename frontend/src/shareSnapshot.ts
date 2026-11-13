export type PageNode = string | { tag: string; attrs: Record<string, string>; children: PageNode[] };
export type PageSnapshot = { title: string; nodes: PageNode[]; capturedAt: string };
const tags = new Set('article section header footer main div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table thead tbody tfoot tr th td caption figure figcaption blockquote pre code strong em small b i u s mark sub sup br hr a img video audio source details summary time label svg g path circle ellipse rect line polyline polygon text tspan defs linearGradient stop'.split(' '));
const attrNames: Record<string, string> = { class: 'className', href: 'href', src: 'src', alt: 'alt', title: 'title',
  colspan: 'colSpan', rowspan: 'rowSpan', width: 'width', height: 'height', viewBox: 'viewBox', d: 'd', fill: 'fill',
  stroke: 'stroke', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
  points: 'points', x: 'x', y: 'y', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', cx: 'cx', cy: 'cy', r: 'r', rx: 'rx', ry: 'ry',
  transform: 'transform', opacity: 'opacity', offset: 'offset', 'stop-color': 'stopColor', 'stop-opacity': 'stopOpacity',
  'text-anchor': 'textAnchor', 'dominant-baseline': 'dominantBaseline', preserveAspectRatio: 'preserveAspectRatio', poster: 'poster', type: 'type' };
const styleNames = new Set('width height min-width max-width min-height max-height color background-color font-size font-weight text-align display grid-template-columns gap flex flex-direction align-items justify-content padding margin border-radius aspect-ratio'.split(' '));
function safeUrl(value: string) {
  if (value.startsWith('/media/') || /^#[\w-]+$/.test(value)) return value;
  try {
    const url = new URL(value, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith('/media/')) return `${url.pathname}${url.search}`;
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== location.origin && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function capturePage(title: string): Pick<PageSnapshot, 'title' | 'nodes'> {
  const root = document.querySelector('.main-content');
  if (!root) throw new Error('当前页面尚未加载完成');
  if (root.querySelector('[role="dialog"], .modal-backdrop')) throw new Error('请先关闭编辑窗口，再分享页面');
  let count = 0;
  function visit(node: Node, depth = 0): PageNode[] {
    if (++count > 20000 || depth > 40) throw new Error('页面内容过多，请分享项目或单份资料');
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [node.textContent] : [];
    if (!(node instanceof Element) || node.matches('.page-share-control, .share-toolbar, script, style, noscript, [role="dialog"], .modal-backdrop, .detail-bottom')) return [];
    const computed = getComputedStyle(node);
    if (computed.display === 'none' || computed.visibility === 'hidden' || node.hasAttribute('hidden')) return [];
    const tag = node.localName;
    if (['button', 'nav'].includes(tag)) {
      if (node.matches('[aria-selected="true"], [aria-current="page"], .selected, .active')) return [{ tag: 'span', attrs: { className: 'share-current-tab' }, children: [node.textContent || ''] }];
      return [];
    }
    if (node instanceof HTMLInputElement) {
      if (['password', 'hidden', 'file', 'button', 'submit'].includes(node.type)) return [];
      const value = ['checkbox', 'radio'].includes(node.type) ? (node.checked ? '已选' : '未选') : node.value;
      return value ? [{ tag: 'span', attrs: { className: 'share-field-value' }, children: [value] }] : [];
    }
    if (node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement)
      return [{ tag: 'span', attrs: { className: 'share-field-value' }, children: [node instanceof HTMLSelectElement ? node.selectedOptions[0]?.textContent || '' : node.value] }];
    if (tag === 'iframe' || tag === 'canvas') {
      const src = safeUrl(node.getAttribute('src') || '');
      return src ? [{ tag: 'a', attrs: { href: src }, children: [node.getAttribute('title') || '打开附件'] }] : [];
    }
    const attrs: Record<string, string> = {};
    for (const attribute of node.attributes) {
      const name = attrNames[attribute.name];
      if (!name) continue;
      let value = attribute.value;
      if (['href', 'src', 'poster'].includes(name)) value = safeUrl(value);
      if (value && value.length <= 4096 && (!['fill', 'stroke'].includes(name) || !/url\s*\(/i.test(value))) attrs[name] = value;
    }
    if (node instanceof HTMLElement || node instanceof SVGElement) {
      const style = Array.from(node.style).filter(name => styleNames.has(name)).map(name => `${name}:${node.style.getPropertyValue(name)}`).join(';');
      if (style && /^[\w\s#%.,()/+:;-]+$/.test(style)) attrs.style = style;
    }
    const children = Array.from(node.childNodes).flatMap(child => visit(child, depth + 1));
    if (tag === 'a' && !attrs.href) return children;
    if (!tags.has(tag)) return children;
    return [{ tag, attrs, children }];
  }
  const nodes = Array.from(root.childNodes).flatMap(child => visit(child));
  if (!nodes.length) throw new Error('当前页面暂无可分享内容');
  return { title: title.slice(0, 240), nodes };
}
