import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, LockKeyhole, Pause, Play, Share2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "./api";
import { Brand, ContentBody, ErrorMessage } from "./components";
import { TripGuide } from "./TripGuide";
import type { Content } from "./types";
import type { Plan } from "./tripGuideModel";
import "./share.css";
import { SharedProject } from './SharedProject';
import { SnapshotPage } from './SnapshotPage';
import type { PageSnapshot } from './shareSnapshot';

type ShareResult =
  | { kind: 'project'; items: Content[]; rootId: number }
  | { kind: 'page'; page: PageSnapshot }
  | { kind: "trip"; project: { id: number; title: string }; plan: Plan }
  | { kind: "content"; content: Omit<Content, "parentId"> & { parentId?: number | null } };

const shareQuotes = [
  // Keep the display line short enough for the narrow password gate.
  { text: "事了拂衣去", source: "李白《侠客行》" },
  { text: "满船清梦压星河", source: "唐温如《题龙阳县青草湖》" },
  { text: "银鞍白马度春风", source: "李白《少年行》" },
  { text: "长风破浪会有时", source: "李白《行路难》" },
  { text: "一蓑烟雨任平生", source: "苏轼《定风波》" },
  { text: "海上生明月", source: "张九龄《望月怀远》" },
  { text: "深藏身与名", source: "李白《侠客行》" },
  { text: "银鞍照白马", source: "李白《侠客行》" },
  { text: "飒沓如流星", source: "李白《侠客行》" },
  { text: "醉后不知天在水", source: "唐温如《题龙阳县青草湖》" },
  { text: "男儿何不带吴钩", source: "李贺《南园十三首》" },
  { text: "一身转战三千里", source: "王维《老将行》" },
  { text: "黄沙百战穿金甲", source: "王昌龄《从军行》" },
  { text: "不破楼兰终不还", source: "王昌龄《从军行》" },
  { text: "醉里挑灯看剑", source: "辛弃疾《破阵子》" },
  { text: "气吞万里如虎", source: "辛弃疾《永遇乐》" },
  { text: "仰天大笑出门去", source: "李白《南陵别儿童入京》" },
  { text: "我辈岂是蓬蒿人", source: "李白《南陵别儿童入京》" },
  { text: "天生我材必有用", source: "李白《将进酒》" },
  { text: "大鹏一日同风起", source: "李白《上李邕》" },
  { text: "扶摇直上九万里", source: "李白《上李邕》" },
  { text: "直挂云帆济沧海", source: "李白《行路难》" },
  { text: "竹杖芒鞋轻胜马", source: "苏轼《定风波》" },
  { text: "莫听穿林打叶声", source: "苏轼《定风波》" },
  { text: "且将新火试新茶", source: "苏轼《望江南》" },
  { text: "海内存知己", source: "王勃《送杜少府之任蜀州》" },
  { text: "柳暗花明又一村", source: "陆游《游山西村》" },
  { text: "春风得意马蹄疾", source: "孟郊《登科后》" },
  { text: "桃李春风一杯酒", source: "黄庭坚《寄黄几复》" },
  { text: "江湖夜雨十年灯", source: "黄庭坚《寄黄几复》" },
  { text: "云想衣裳花想容", source: "李白《清平调》" },
  { text: "举杯邀明月", source: "李白《月下独酌》" },
  { text: "春水碧于天", source: "韦庄《菩萨蛮》" },
  { text: "画船听雨眠", source: "韦庄《菩萨蛮》" },
  { text: "天涯何处无芳草", source: "苏轼《蝶恋花》" },
  { text: "人间有味是清欢", source: "苏轼《浣溪沙》" },
  { text: "只愿君心似我心", source: "李之仪《卜算子》" },
  { text: "山有木兮木有枝", source: "《越人歌》" },
  { text: "玲珑骰子安红豆", source: "温庭筠《新添声杨柳枝》" },
  { text: "身无彩凤双飞翼", source: "李商隐《无题》" },
  { text: "此情可待成追忆", source: "李商隐《锦瑟》" },
  { text: "坐看云起时", source: "王维《终南别业》" },
  { text: "但愿人长久", source: "苏轼《水调歌头》" },
  { text: "星垂平野阔", source: "杜甫《旅夜书怀》" },
  { text: "江流天地外", source: "王维《汉江临泛》" },
  { text: "学不可以已", source: "《荀子·劝学》" },
  { text: "绝知此事要躬行", source: "陆游《冬夜读书示子聿》" },
  { text: "有朋自远方来", source: "《论语·学而》" },
];

function ShareQuotes() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (paused || interacting || focused) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % shareQuotes.length), 4500);
    return () => window.clearInterval(timer);
  }, [paused, interacting, focused, index]);
  const move = (step: number) => setIndex(value => (value + step + shareQuotes.length) % shareQuotes.length);
  return <section className="share-quote" aria-label="古诗词与经典短语" aria-roledescription="轮播"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <blockquote className="share-quote-text" key={index}>{shareQuotes[index].text}</blockquote>
    <div className="share-quote-footer">
      <cite>{shareQuotes[index].source}</cite>
      <div className="share-quote-controls">
        <button type="button" aria-label="上一句" title="上一句" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <button type="button" aria-label={paused ? "继续轮播" : "暂停轮播"} title={paused ? "继续轮播" : "暂停轮播"} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
        <button type="button" aria-label="下一句" title="下一句" onClick={() => move(1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  </section>;
}

export function SharePage() {
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setTimeout(() => setRetryAfter(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfter]);
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || retryAfter > 0) return;
    const enteredPassword = String(new FormData(event.currentTarget).get("password") || "");
    setBusy(true); setError("");
    try {
      setResult(await api<ShareResult>("/share-links/verify", {
        method: "POST", body: JSON.stringify({ token, password: enteredPassword }),
      }));
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "分享页面暂时无法打开");
      if (err instanceof ApiError && err.status === 429 && err.retryAfter) setRetryAfter(err.retryAfter);
    } finally { setBusy(false); }
  }
  if (result?.kind === "trip") return <main className="share-page share-result">
    <div className="share-brand"><Brand /></div>
    <div className="share-result-label"><Share2 size={15} /> 文隽分享 · {result.project.title}</div>
    <TripGuide plan={result.plan} onBack={() => setResult(null)} onEdit={() => undefined} readOnly />
  </main>;
  if (result?.kind === "content") return <main className="share-page share-result">
    <div className="share-brand"><Brand /></div>
    <div className="share-result-label"><Share2 size={15} /> 文隽分享</div>
    <article className="share-content"><h1>{result.content.title}</h1><ContentBody content={result.content as Content} /></article>
  </main>;
  if (result?.kind === 'project' || result?.kind === 'page') return <main className="share-page share-result share-wide-result">
    <div className="share-brand"><Brand /></div>
    <div className="share-result-label"><Share2 size={15} /> 文隽分享 · {result.kind === 'project' ? '项目与资料' : '当前页面'}</div>
    {result.kind === 'project' ? <SharedProject key={result.rootId} items={result.items} rootId={result.rootId} /> : <SnapshotPage page={result.page} />}
  </main>;
  return <main className="share-page">
    <div className="share-card">
      <div className="share-brand"><Brand /></div>
      <div className="share-lock"><LockKeyhole size={28} /></div>
      <p className="eyebrow">VAULTVIEW · SECURE SHARE</p>
      <h1 className="share-page-purpose">打开分享页面</h1>
      <ShareQuotes />
      <p>请输入分享密码，查看指定的项目或页面。</p>
      <form onSubmit={verify}>
        <label htmlFor="share-password">分享密码</label>
        <div className="share-password-input">
          <input id="share-password" name="password" type={visible ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="请输入分享密码" required maxLength={256} />
          <button type="button" className="icon-button" aria-label={visible ? "隐藏密码" : "显示密码"} title={visible ? "隐藏密码" : "显示密码"} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
        <ErrorMessage message={error} />
        {retryAfter > 0 && <p className="share-retry" role="status">请在 {Math.floor(retryAfter / 60)} 分 {String(retryAfter % 60).padStart(2, "0")} 秒后重试</p>}
        <button className="button primary" disabled={busy || retryAfter > 0}>{busy ? "正在验证…" : "查看页面"}</button>
      </form>
      <small>此链接仅开放指定范围的只读内容，不会打开资料库其他项目。</small>
    </div>
  </main>;
}
