import { useState } from "react";
import { Share2 } from "lucide-react";
import { api } from "./api";
import { capturePage } from './shareSnapshot';

type Target = { kind: "trip"; projectId: number; tripId: number } | { kind: "content"; contentId: number }
  | { kind: 'project'; contentId: number } | { kind: 'page'; contentId?: number; title: string };

export function ShareLinkButton({ target, label = '分享页面' }: { target: Target; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  async function share() {
    setBusy(true); setNotice("");
    try {
      const payload = target.kind === 'page' ? { kind: target.kind, contentId: target.contentId, page: capturePage(target.title) } : target;
      const result = await api<{ url: string }>("/share-links", { method: "POST", body: JSON.stringify(payload) });
      setUrl(result.url);
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(result.url);
        setNotice("链接已复制，30 天内有效");
      } catch { setNotice("分享链接已生成，30 天内有效"); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法生成分享链接"); }
    finally { setBusy(false); }
  }
  return <span className="page-share-control">
    <button className="button" title={target.kind === 'project' ? '只读分享此目录及其资料' : target.kind === 'page' ? '只读分享当前页面快照' : '只读分享当前资料'} onClick={() => void share()} disabled={busy}><Share2 size={15} />{busy ? "生成中…" : label}</button>
    {notice && <small role="status">{notice}</small>}
    {url && <input aria-label="单页分享链接" readOnly value={url} onFocus={event => event.target.select()} />}
  </span>;
}
