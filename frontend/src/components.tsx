import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Folder,
  FileText,
  Film,
  Presentation,
  BookOpen,
  Maximize,
  Download,
  AlertCircle,
  Image as ImageIcon,
  Network,
  Compass,
  Lightbulb,
  Wrench,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Hash,
  CalendarDays,
  Swords,
  Mountain,
  Flag,
  Feather,
  ScrollText,
} from "lucide-react";
import { scenes, type Content, type ContentType } from "./types";
import { flatten } from "./types";
import { professionalModuleTarget } from "./projectNavigation";
import { visibleBaselineDescription } from "./learningBasicsModel";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <span aria-hidden="true">藏</span>
      </span>
      <span>
        <strong>观澜</strong>
        <small>江湖行者 · VaultView</small>
      </span>
    </div>
  );
}

export function PersonalMotto({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`personal-motto${compact ? " compact" : ""}`}
      title="化用《孟子·尽心上》。原文：穷则独善其身，达则兼善天下。"
    >
      <span>穷则独善其身，</span><span>达则兼济天下。</span>
    </p>
  );
}
export function TypeIcon({
  type,
  size = 18,
}: {
  type: ContentType;
  size?: number;
}) {
  const Icon = {
    folder: Folder,
    video: Film,
    ppt: Presentation,
    mindmap: Network,
    longimage: ImageIcon,
    pdf: FileText,
    text: BookOpen,
  }[type];
  return <Icon size={size} />;
}
export function TopicPills({ topics }: { topics: string[] | null }) {
  return (
    <span className="topic-pills">
      {(topics || []).map((topic, index) => {
        const isCycle = index === 0 && ["长期性", "阶段性", "临时性"].includes(topic);
        const Icon = isCycle ? CalendarDays : Hash;
        return (
          <span
            className={`topic-pill ${isCycle ? "project-cycle-pill" : ""}`}
            data-topic={topic.toLowerCase()}
            data-cycle={isCycle ? topic : undefined}
            key={`${topic}-${index}`}
          >
            <Icon size={11} aria-hidden="true" />
            <span>{topic}</span>
          </span>
        );
      })}
    </span>
  );
}
type GrowthView = "record" | "plan" | "stage" | "showcase";

const growthModuleLabels: Array<[GrowthView, string, string]> = [
  ["record", "专业成长记录", "记录一次完整实践闭环"],
  ["plan", "成长计划", "把方向拆成每周行动"],
  ["stage", "阶段方案", "用里程碑推进长期成长"],
  ["showcase", "成果展示", "把证据讲成作品故事"],
];
const growthModuleMatch: Record<GrowthView, string[]> = {
  record: ["专业成长与实践记录"],
  plan: ["成长计划"],
  stage: ["阶段方案"],
  showcase: ["成果展示"],
};

export function ProfessionalGrowthDashboard({
  modules,
  onOpenModule,
}: {
  modules?: Content[];
  onOpenModule: (content: Content) => void;
}) {
  const availableModules = modules ?? [];
  const [view, setView] = useState<GrowthView>(() => {
    try {
      const saved = window.localStorage.getItem("vaultview-castle-growth-tab");
      return growthModuleLabels.some(([key]) => key === saved)
        ? (saved as GrowthView)
        : "record";
    } catch {
      return "record";
    }
  });
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const saved: unknown = JSON.parse(
        window.localStorage.getItem("vaultview-castle-growth-checklist") ||
          "{}",
      );
      return saved && typeof saved === "object" && !Array.isArray(saved)
        ? Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "boolean"))
        : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(
      "vaultview-castle-growth-checklist",
      JSON.stringify(checked),
    ); } catch { /* Keep the current session usable when storage is unavailable. */ }
  }, [checked]);
  useEffect(() => {
    try { window.localStorage.setItem("vaultview-castle-growth-tab", view); } catch { /* Session state still works. */ }
  }, [view]);
  const tasks: Array<[string, GrowthView]> = [
    ["写下一个真实问题和验收标准", "record"],
    ["拆出一个本周可完成的小目标", "plan"],
    ["完成一次练习并留下过程记录", "stage"],
    ["整理一个可以展示的成果卡", "showcase"],
  ] as const;
  const completed = tasks.filter(([label]) => checked[label]).length;
  const route = [
    ["启蒙", "观察和描述", Lightbulb],
    ["筑基", "规则变成程序", Wrench],
    ["进阶", "数据验证想法", Compass],
    ["实战", "完成一个项目", Sparkles],
    ["迁移", "帮助真实的人", ShieldCheck],
  ] as const;
  return (
    <section className="growth-dashboard" aria-label="专业成长互动看板">
      <div className="growth-dashboard-head">
        <div>
          <p className="eyebrow">MISSION CONTROL</p>
          <h2>今天也向前走一小步</h2>
          <p>把专业成长变成一场看得见进度的探险。</p>
        </div>
        <div
          className="growth-progress"
          aria-label={`已完成 ${completed} 项，共 ${tasks.length} 项`}
        >
          <strong>
            {completed}/{tasks.length}
          </strong>
          <span>本次探索</span>
        </div>
      </div>
      <div className="growth-route" aria-label="五阶段成长路径">
        {route.map(([label, hint, Icon], index) => (
          <div className="growth-route-step" key={label}>
            <span className="growth-route-icon">
              <Icon size={15} />
            </span>
            <span className="growth-route-copy">
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
            {index < route.length - 1 && <i aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="growth-tabs" role="tablist" aria-label="成长栏目切换">
        {growthModuleLabels.map(([key, label, hint]) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            role="tab"
            id={"growth-tab-" + key}
            tabIndex={view === key ? 0 : -1}
            aria-selected={view === key}
            aria-controls={"growth-panel-" + key}
            onClick={() => setView(key)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const index = growthModuleLabels.findIndex(([value]) => value === key);
              const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? growthModuleLabels.length - 1
                : (index + (event.key === "ArrowRight" ? 1 : -1) + growthModuleLabels.length) % growthModuleLabels.length;
              const nextView = growthModuleLabels[nextIndex][0];
              setView(nextView);
              document.getElementById("growth-tab-" + nextView)?.focus();
            }}
          >
            <span>{label}</span>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      <div className="growth-dashboard-body" id={"growth-panel-" + view} role="tabpanel" aria-labelledby={"growth-tab-" + view}>
        {(() => {
          const activeLabel = growthModuleLabels.find(([key]) => key === view)?.[1] || "";
          const module = availableModules.find((item) =>
            growthModuleMatch[view].some((keyword) => item.title.includes(keyword)),
          );
          const target = professionalModuleTarget(module || undefined);
          return (
            <div className="growth-module-note">
              <div>
                <strong>{activeLabel}</strong>
                <span>{module ? (module.type === "folder" ? "课程方案与记录模板" : "实践记录模板") : "请从下方资料目录选择"}</span>
              </div>
              {target && (
                <button type="button" className="text-link" onClick={() => onOpenModule(target)}>
                  打开模板 <ArrowRight size={14} />
                </button>
              )}
            </div>
          );
        })()}
        {view === "record" && (
          <div className="growth-showcase-grid growth-record-visual">
            <article><strong>问题</strong><span>我想改变什么？</span></article>
            <article><strong>证据</strong><span>我怎样证明做到了？</span></article>
            <article><strong>复盘</strong><span>下一轮只改什么？</span></article>
          </div>
        )}
        {view === "plan" && (
          <div className="growth-visual growth-plan-visual">
            <article>
              <Lightbulb size={18} />
              <strong>想去的方向</strong>
              <span>写下一个想弄懂的问题</span>
            </article>
            <strong className="growth-arrow" aria-hidden="true">→</strong>
            <article>
              <Wrench size={18} />
              <strong>本周小目标</strong>
              <span>拆成一次可完成的练习</span>
            </article>
            <strong className="growth-arrow" aria-hidden="true">→</strong>
            <article>
              <Sparkles size={18} />
              <strong>今天的一步</strong>
              <span>留下一个过程证据</span>
            </article>
          </div>
        )}
        {view === "stage" && (
          <div className="growth-visual growth-stage-visual">
            {["起点", "练习", "复盘", "里程碑"].map((label, index) => (
              <span className={index === 0 ? "done" : ""} key={label}>
                {label}
              </span>
            ))}
          </div>
        )}
        {view === "showcase" && (
          <div className="growth-showcase-grid">
            <article>
              <strong>过程</strong>
              <span>我怎么做的</span>
            </article>
            <article>
              <strong>作品</strong>
              <span>我完成了什么</span>
            </article>
            <article>
              <strong>反思</strong>
              <span>下一次怎么更好</span>
            </article>
          </div>
        )}
        <div className="growth-checklist">
          {tasks.map(([label, tab]) => (
            <label key={label}>
              <input
                type="checkbox"
                checked={Boolean(checked[label])}
                onChange={(event) =>
                  setChecked((current) => ({
                    ...current,
                    [label]: event.target.checked,
                  }))
                }
              />
              <span className={`growth-check ${tab}`} />
              {label}
            </label>
          ))}
          <button
            className="growth-reset"
            type="button"
            title="清空本次探索进度"
            aria-label="清空本次探索进度"
            onClick={() => setChecked({})}
          >
            <RotateCcw size={13} />
            清空进度
          </button>
        </div>
      </div>
    </section>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      <AlertCircle size={17} />
      <span>{message}</span>
    </div>
  ) : null;
}
const sceneIcons = {
  system: ShieldCheck,
  tools: Swords,
  life: Mountain,
  work: Flag,
  hobbies: Feather,
  other: ScrollText,
};

function FolderTreeNode({ item, selected, onSelect, onOpenFolder, scene }: {
  item: Content;
  selected: number | null;
  onSelect: (id: number) => void;
  onOpenFolder?: (folder: Content) => void;
  scene?: (typeof scenes)[number];
}) {
  const containsSelected = flatten(item.children || []).some((node) => node.id === selected);
  const [open, setOpen] = useState(containsSelected || scene?.key === "other");
  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected, selected]);
  const label = scene?.label || item.title;
  const SceneIcon = scene ? sceneIcons[scene.key] : null;
  const childrenId = `tree-children-${item.id}`;
  return (
    <div className={scene ? "scene-tree-node" : "folder-tree-node"}>
      <div className={`tree-folder-row ${scene ? "scene-folder-row" : ""} ${selected === item.id ? "active" : ""}`}>
        <button
          type="button"
          className="tree-folder-toggle"
          aria-label={`${open ? "折叠" : "展开"}${label}`}
          aria-expanded={open}
          aria-controls={childrenId}
          onClick={() => setOpen((current) => !current)}
          title={`${open ? "折叠" : "展开"}${label}`}
        >
          <ChevronRight size={15} className={open ? "chevron expanded" : "chevron"} />
        </button>
        <button
          type="button"
          className="tree-folder-link"
          title={label}
          aria-current={selected === item.id ? "page" : undefined}
          onClick={() => onOpenFolder?.(item)}
        >
          {SceneIcon && scene ? <SceneIcon size={24} className={`scene-icon ${scene.key}`} strokeWidth={1.7} aria-hidden="true" /> : <Folder size={17} />}
          <span>{label}</span>
          <small>{item.children?.length || 0}</small>
        </button>
      </div>
      <div id={childrenId} hidden={!open}>
        <ContentTree items={item.children || []} selected={selected} onSelect={onSelect} onOpenFolder={onOpenFolder} />
      </div>
    </div>
  );
}

export function ContentTree({
  items,
  selected,
  onSelect,
  onOpenFolder,
}: {
  items: Content[];
  selected: number | null;
  onSelect: (id: number) => void;
  onOpenFolder?: (folder: Content) => void;
}) {
  return (
    <div className="content-tree">
      {items.map((item) =>
        item.type === "folder" ? (
          <FolderTreeNode key={item.id} item={item} selected={selected} onSelect={onSelect} onOpenFolder={onOpenFolder} />
        ) : (
          <button
            key={item.id}
            className={`tree-item ${selected === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
            aria-current={selected === item.id ? "page" : undefined}
          >
            <TypeIcon type={item.type} />
            <span>{item.title}</span>
          </button>
        ),
      )}
    </div>
  );
}
export function SceneNavigator({
  items,
  selected,
  onSelect,
  onOpenFolder,
}: {
  items: Content[];
  selected: number | null;
  onSelect: (id: number) => void;
  onOpenFolder?: (folder: Content) => void;
}) {
  return (
    <div className="scene-navigator">
      {scenes.map((scene) => {
        const root = items.find(
          (item) =>
            item.type === "folder" &&
            item.scene === scene.key &&
            item.parentId === null,
        );
        return (
          root ? <FolderTreeNode key={scene.key} item={root} scene={scene} selected={selected} onSelect={onSelect} onOpenFolder={onOpenFolder} />
            : <div className="scene-empty" key={scene.key}>{scene.label} · 暂无资料</div>
        );
      })}
    </div>
  );
}
function VideoPlayer({ content }: { content: Content }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = video.current!;
    const source = content.hlsUrl || content.fileUrl || "";
    let hls: Hls | undefined;
    let disposed = false;
    setError("");
    if (
      content.hlsUrl &&
      !element.canPlayType("application/vnd.apple.mpegurl")
    ) {
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(source);
            hls.attachMedia(element);
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) setError("视频暂时无法播放，请检查媒体地址");
            });
          } else setError("当前浏览器不支持此视频格式");
        })
        .catch(() => {
          if (!disposed) setError("播放器加载失败，请刷新页面重试");
        });
    } else element.src = source;
    const restore = () => {
      try {
        const seconds = Number(localStorage.getItem(`video:${content.id}`));
        if (seconds > 0 && seconds < element.duration - 1)
          element.currentTime = seconds;
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
    };
    const save = () => {
      if (element.readyState === 0) return;
      try {
        localStorage.setItem(
          `video:${content.id}`,
          String(element.currentTime),
        );
      } catch {
        /* Playback works without storage. */
      }
    };
    element.addEventListener("loadedmetadata", restore);
    element.addEventListener("pause", save);
    return () => {
      disposed = true;
      save();
      hls?.destroy();
      element.removeEventListener("loadedmetadata", restore);
      element.removeEventListener("pause", save);
      element.removeAttribute("src");
      element.load();
    };
  }, [content.id, content.fileUrl, content.hlsUrl]);
  return (
    <>
      <video
        ref={video}
        controls
        playsInline
        preload="metadata"
        poster={content.coverUrl || undefined}
        onError={() => setError("视频暂时无法播放，请检查媒体地址")}
        className="video-player"
      />
      <ErrorMessage message={error} />
    </>
  );
}
function PptViewer({ images }: { images: string[] }) {
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const go = (next: number) => {
    setError("");
    setPage(Math.min(images.length - 1, Math.max(0, next)));
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch {
      setError("当前浏览器暂不支持全屏");
    }
  };
  if (!images.length) return <div className="empty">暂无幻灯片</div>;
  return (
    <div
      className="slide-viewer"
      ref={container}
      tabIndex={0}
      aria-label="幻灯片阅读器"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(page - 1);
        if (e.key === "ArrowRight") go(page + 1);
      }}
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touch.current !== null) {
          const delta = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 50) go(page + (delta < 0 ? 1 : -1));
        }
        touch.current = null;
      }}
    >
      <div className="slide-stage">
        <img
          src={images[page]}
          alt={`第 ${page + 1} 页幻灯片`}
          onError={() => setError("这张幻灯片无法加载")}
        />
      </div>
      <div className="slide-controls">
        <span>
          {String(page + 1).padStart(2, "0")}{" "}
          <span className="muted">
            / {String(images.length).padStart(2, "0")}
          </span>
        </span>
        <div>
          <button
            className="icon-button"
            title="上一页"
            aria-label="上一页"
            disabled={page === 0}
            onClick={() => go(page - 1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="icon-button"
            title="下一页"
            aria-label="下一页"
            disabled={page === images.length - 1}
            onClick={() => go(page + 1)}
          >
            <ChevronRight size={19} />
          </button>
          <button
            className="icon-button"
            title="全屏"
            aria-label="全屏"
            onClick={fullscreen}
          >
            <Maximize size={17} />
          </button>
        </div>
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}
function LongImageViewer({ images }: { images: string[] }) {
  const [error, setError] = useState("");
  if (!images.length) return <div className="empty">暂无长图</div>;
  return (
    <div className="long-image-viewer" aria-label="长图阅读器">
      {images.map((image, index) => (
        <img
          key={image}
          src={image}
          alt={`第 ${index + 1} 张长图`}
          loading={index === 0 ? "eager" : "lazy"}
          onError={() => setError("长图无法加载")}
        />
      ))}
      <ErrorMessage message={error} />
    </div>
  );
}
type MindMapBranch = { label: string; color: string; items: string[] };
type MindMapData = {
  root: string;
  subtitle: string;
  branches: MindMapBranch[];
};

type TravelDestination = {
  name: string;
  region: string;
  route: string;
  duration: string;
  transport: string;
  score: number;
  popularity: number;
  freshness: number;
  season: string;
  time: string;
  tags: string[];
  human: number;
  nature: number;
  highlights: string[];
  recommendation: string;
};
type TravelDashboardData = {
  title: string;
  subtitle: string;
  updatedAt: string;
  seasons: Array<{
    label: string;
    months: string;
    focus: string;
    color: string;
  }>;
  periods: Array<{ label: string; window: string; note: string }>;
  destinations: TravelDestination[];
};

const defaultTravelDashboard: TravelDashboardData = {
  title: "南京出发目的地雷达",
  subtitle: "按季节、时间周期与景观构成，快速找到值得去的下一站",
  updatedAt: "待更新",
  seasons: [],
  periods: [],
  destinations: [],
};

function TravelGuideViewer({ description }: { description: string }) {
  const marker = "<!-- TRAVEL_GUIDE_DASHBOARD -->";
  const markerIndex = description.indexOf(marker);
  let data = defaultTravelDashboard;
  if (markerIndex >= 0) {
    try {
      data = JSON.parse(
        description.slice(markerIndex + marker.length).trim(),
      ) as TravelDashboardData;
    } catch {
      data = defaultTravelDashboard;
    }
  }
  const overview =
    markerIndex >= 0 ? description.slice(0, markerIndex) : description;
  const [season, setSeason] = useState("全部");
  const [sort, setSort] = useState<"score" | "popularity" | "freshness">(
    "score",
  );
  const filtered = data.destinations
    .filter(
      (destination) => season === "全部" || destination.season.includes(season),
    )
    .sort((a, b) => {
      if (sort === "popularity") return b.popularity - a.popularity;
      if (sort === "freshness") return b.freshness - a.freshness;
      return b.score - a.score;
    });
  return (
    <div className="travel-guide">
      <section className="travel-hero">
        <div>
          <p className="eyebrow">TRAVEL RADAR · NANJING DEPARTURE</p>
          <h3>{data.title}</h3>
          <p>{data.subtitle}</p>
        </div>
        <span className="travel-updated">更新于 {data.updatedAt}</span>
      </section>
      <section className="travel-seasons" aria-label="季节筛选">
        <button
          className={season === "全部" ? "active" : ""}
          onClick={() => setSeason("全部")}
        >
          全年
        </button>
        {data.seasons.map((item) => (
          <button
            key={item.label}
            className={season === item.label ? "active" : ""}
            style={{ "--season-color": item.color } as React.CSSProperties}
            onClick={() => setSeason(item.label)}
          >
            <strong>{item.label}</strong>
            <span>{item.months}</span>
          </button>
        ))}
      </section>
      <div className="travel-season-notes">
        {data.seasons.map((item) => (
          <span key={item.label}>
            <b>{item.label}</b> {item.focus}
          </span>
        ))}
      </div>
      <section className="travel-periods" aria-label="时间周期">
        <div className="section-kicker">出行节奏</div>
        {data.periods.map((item) => (
          <div className="travel-period" key={item.label}>
            <b>{item.label}</b>
            <span>{item.window}</span>
            <small>{item.note}</small>
          </div>
        ))}
      </section>
      <section className="travel-toolbar">
        <div>
          <span className="section-kicker">目的地推荐</span>
          <strong>{filtered.length} 个候选</strong>
        </div>
        <div className="travel-sort" role="group" aria-label="目的地排序">
          <span>排序</span>
          <button
            className={sort === "score" ? "active" : ""}
            onClick={() => setSort("score")}
          >
            综合评分
          </button>
          <button
            className={sort === "popularity" ? "active" : ""}
            onClick={() => setSort("popularity")}
          >
            热门度
          </button>
          <button
            className={sort === "freshness" ? "active" : ""}
            onClick={() => setSort("freshness")}
          >
            新鲜度
          </button>
        </div>
      </section>
      <div className="travel-destination-grid">
        {filtered.map((destination) => (
          <article className="travel-destination" key={destination.name}>
            <div className="travel-destination-top">
              <div>
                <span className="travel-region">{destination.region}</span>
                <h4>{destination.name}</h4>
              </div>
              <div className="travel-score">
                <strong>{destination.score.toFixed(1)}</strong>
                <span>综合评分</span>
              </div>
            </div>
            <p className="travel-route">
              {destination.route} · {destination.duration} ·{" "}
              {destination.transport}
            </p>
            <div className="travel-metrics">
              <span>
                <b>热度</b>
                <i>
                  <em style={{ width: `${destination.popularity}%` }} />
                </i>
                {destination.popularity}
              </span>
              <span>
                <b>人文</b>
                <i>
                  <em
                    className="human"
                    style={{ width: `${destination.human * 10}%` }}
                  />
                </i>
                {destination.human}/10
              </span>
              <span>
                <b>自然</b>
                <i>
                  <em
                    className="nature"
                    style={{ width: `${destination.nature * 10}%` }}
                  />
                </i>
                {destination.nature}/10
              </span>
            </div>
            <div className="travel-tags">
              {destination.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            <p className="travel-highlights">
              {destination.highlights.join(" · ")}
            </p>
            <footer>
              <span>
                适合 {destination.season} · {destination.time}
              </span>
              <strong>新鲜度 {destination.freshness}%</strong>
            </footer>
            <div className="travel-recommendation">
              {destination.recommendation}
            </div>
          </article>
        ))}
      </div>
      <div className="markdown article-body travel-overview">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{overview}</ReactMarkdown>
      </div>
    </div>
  );
}

type TravelCityAttraction = {
  name: string;
  kind: string;
  time: string;
  detail: string;
};
type TravelCity = {
  city: string;
  region: string;
  route: string;
  duration: string;
  bestSeason: string;
  score: number;
  image: string;
  imageAlt: string;
  intro: string;
  attractions: TravelCityAttraction[];
};
type TravelCityAtlasData = {
  updatedAt: string;
  cities: TravelCity[];
};

function TravelCityAtlasViewer({ description }: { description: string }) {
  const marker = "<!-- TRAVEL_CITY_ATLAS -->";
  const markerIndex = description.indexOf(marker);
  let data: TravelCityAtlasData = { updatedAt: "待更新", cities: [] };
  if (markerIndex >= 0) {
    try {
      data = JSON.parse(
        description.slice(markerIndex + marker.length).trim(),
      ) as TravelCityAtlasData;
    } catch {
      data = { updatedAt: "待更新", cities: [] };
    }
  }
  const overview =
    markerIndex >= 0 ? description.slice(0, markerIndex) : description;
  const [activeCity, setActiveCity] = useState(0);
  const city = data.cities[activeCity] || data.cities[0];
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [city?.image]);
  if (!city) return <div className="empty">暂无城市图鉴</div>;
  return (
    <div className="travel-city-atlas">
      <section className="travel-atlas-heading">
        <div>
          <p className="eyebrow">CITY ATLAS · SCENIC GUIDE</p>
          <h3>南京出发城市景点图鉴</h3>
          <p>每座城市一张路线卡：先看景观，再决定季节、交通与游览强度。</p>
        </div>
        <span>更新于 {data.updatedAt}</span>
      </section>
      <nav className="travel-city-tabs" aria-label="城市图鉴导航">
        {data.cities.map((item, index) => (
          <button
            key={item.city}
            className={index === activeCity ? "active" : ""}
            onClick={() => setActiveCity(index)}
          >
            <strong>{item.city}</strong>
            <small>{item.duration}</small>
          </button>
        ))}
      </nav>
      <section className="travel-city-hero">
        <div className={`travel-city-image ${imageFailed ? "failed" : ""}`}>
          {!imageFailed ? (
            <img
              src={city.image}
              alt={city.imageAlt}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>
              景观图暂未加载
              <br />
              <small>可在管理页替换为本地图片</small>
            </span>
          )}
          <span className="travel-city-image-label">
            {city.city} · 景观参考图
          </span>
        </div>
        <div className="travel-city-copy">
          <div className="travel-city-copy-top">
            <div>
              <span>{city.region}</span>
              <h4>{city.city}</h4>
            </div>
            <div className="travel-city-rating">
              <strong>{city.score.toFixed(1)}</strong>
              <small>规划评分</small>
            </div>
          </div>
          <p>{city.intro}</p>
          <div className="travel-city-facts">
            <span>
              <b>路线</b>
              {city.route}
            </span>
            <span>
              <b>车程</b>
              {city.duration}
            </span>
            <span>
              <b>季节</b>
              {city.bestSeason}
            </span>
          </div>
        </div>
      </section>
      <div className="travel-attractions-heading">
        <div>
          <p className="eyebrow">SCENIC POINTS</p>
          <h4>代表景点与玩法</h4>
        </div>
        <span>{city.attractions.length} 个重点点位</span>
      </div>
      <div className="travel-attraction-grid">
        {city.attractions.map((attraction, index) => (
          <article className="travel-attraction" key={attraction.name}>
            <div className="travel-attraction-top">
              <span>0{index + 1}</span>
              <b>{attraction.kind}</b>
              <small>{attraction.time}</small>
            </div>
            <h5>{attraction.name}</h5>
            <p>{attraction.detail}</p>
          </article>
        ))}
      </div>
      <div className="markdown article-body travel-atlas-overview">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{overview}</ReactMarkdown>
      </div>
    </div>
  );
}

const defaultMindMap: MindMapData = {
  root: "AI 使用技能分享",
  subtitle: "从会问到能交付",
  branches: [],
};
function MindMapViewer({ description }: { description: string }) {
  const marker = "<!-- AI_MINDMAP -->";
  const markerIndex = description.indexOf(marker);
  let data = defaultMindMap;
  if (markerIndex >= 0) {
    try {
      data = JSON.parse(
        description.slice(markerIndex + marker.length).trim(),
      ) as MindMapData;
    } catch {
      data = defaultMindMap;
    }
  }
  return (
    <div className="mindmap-viewer" aria-label="AI 课程思维导图">
      <div className="mindmap-root">
        <Network size={19} />
        <strong>{data.root}</strong>
        <span>{data.subtitle}</span>
      </div>
      <div className="mindmap-branches">
        {data.branches.map((branch) => (
          <section
            className="mindmap-branch"
            key={branch.label}
            style={{ "--branch-color": branch.color } as React.CSSProperties}
          >
            <h3>{branch.label}</h3>
            <ul>
              {branch.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mindmap-note">课程文档、课件、长图与动画视频</p>
    </div>
  );
}
function CourseDocumentViewer({ description }: { description: string }) {
  const marker = "<!-- AI_COURSE_SECTIONS -->";
  const markerIndex = description.indexOf(marker);
  const overview =
    markerIndex >= 0 ? description.slice(0, markerIndex) : description;
  const sectionSource =
    markerIndex >= 0 ? description.slice(markerIndex + marker.length) : "";
  const sections = sectionSource
    .split(/\n(?=## \d{2} )/)
    .map((section) => {
      const heading = section.match(/^## (.+)$/m)?.[1]?.trim();
      return heading ? { heading, markdown: section.trim() } : null;
    })
    .filter((section): section is { heading: string; markdown: string } =>
      Boolean(section),
    )
    .filter((section) => !section.heading.startsWith("00 "));
  const [active, setActive] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  return (
    <div className="course-document">
      <div className="course-document-header">
        {sections.length > 0 && (
          <div className="course-tabs" role="tablist" aria-label="课程章节">
            {sections.map((section, index) => (
              <button
                key={section.heading}
                className={index === active ? "active" : ""}
                role="tab"
                aria-selected={index === active}
                onClick={() => setActive(index)}
              >
                {section.heading.replace(/^\d{2}\s*/, "")}
              </button>
            ))}
          </div>
        )}
        <button
          className="course-overview-toggle"
          aria-expanded={showOverview}
          onClick={() => setShowOverview((visible) => !visible)}
        >
          <ChevronDown size={15} className={showOverview ? "rotated" : ""} />
          {showOverview ? "收起课程总览" : "展开课程总览"}
        </button>
      </div>
      {showOverview && (
        <div className="markdown article-body course-overview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{overview}</ReactMarkdown>
        </div>
      )}
      {sections.length > 0 && (
        <>
          <div className="markdown article-body course-section" role="tabpanel">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {sections[active]?.markdown || ""}
            </ReactMarkdown>
          </div>
        </>
      )}
    </div>
  );
}
export function ContentBody({ content: sourceContent }: { content: Content }) {
  const description = visibleBaselineDescription(sourceContent.description);
  const content = description === sourceContent.description ? sourceContent : { ...sourceContent, description };
  const isCourseDocument =
    content.type === "text" &&
    content.title.startsWith("课程文档｜") &&
    content.description.includes("<!-- AI_COURSE_SECTIONS -->");
  const isTravelGuide =
    content.type === "text" &&
    content.title.startsWith("00 旅行说明") &&
    content.description.includes("<!-- TRAVEL_GUIDE_DASHBOARD -->");
  const isTravelCityAtlas =
    content.type === "text" &&
    content.title.startsWith("01 目的地池") &&
    content.description.includes("<!-- TRAVEL_CITY_ATLAS -->");
  const isMindMap = content.type === "mindmap";
  return (
    <div className="content-body">
      {content.type === "video" && <VideoPlayer content={content} />}{" "}
      {content.type === "ppt" && (
        <PptViewer key={content.id} images={content.imagesJson || []} />
      )}{" "}
      {content.type === "mindmap" && (
        <MindMapViewer key={content.id} description={content.description} />
      )}{" "}
      {content.type === "longimage" && (
        <LongImageViewer key={content.id} images={content.imagesJson || []} />
      )}{" "}
      {content.type === "pdf" && (
        <>
          <div className="pdf-toolbar">
            <span>
              <FileText size={16} /> PDF 文档
            </span>
            <a
              className="text-link"
              href={content.pdfUrl || content.fileUrl || "#"}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={16} /> 打开文档
            </a>
          </div>
          <iframe
            className="pdf-frame"
            title={content.title}
            src={content.pdfUrl || content.fileUrl || undefined}
          />
        </>
      )}{" "}
      {isTravelCityAtlas ? (
        <TravelCityAtlasViewer description={content.description} />
      ) : isTravelGuide ? (
        <TravelGuideViewer description={content.description} />
      ) : isCourseDocument ? (
        <CourseDocumentViewer key={content.id} description={content.description} />
      ) : isMindMap ? null : content.description ? (
        <div
          className={`markdown ${content.type === "text" ? "article-body" : ""}`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.description.replace(/^<!-- FAMILY_HEALTH_DOC:[a-z-]+ -->\s*/, '')}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
export { ChevronDown };
