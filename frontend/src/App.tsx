import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
  Link,
  useLocation,
} from "react-router-dom";
import {
  ArrowRight,
  Search,
  LogOut,
  Settings2,
  Library,
  Plus,
  Pencil,
  Trash2,
  X,
  Menu,
  LockKeyhole,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  FolderOpen,
  ChevronRight,
  Compass,
  Layers3,
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  Filter,
  RotateCcw,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  House,
  UserRound,
  GraduationCap,
  FlaskConical,
  Dumbbell,
  Network,
  Link2,
  Tags,
} from "lucide-react";
import { api, ApiError } from "./api";
import { LearningBasics, LearningReference } from "./LearningBasics";
import { learningBasicsDocument, learningBasicsFolder } from "./learningBasicsModel";
import { TripPlans, isTravelProject } from "./TripPlans";
import { Accounts, PasswordChange } from "./Accounts";
import type { SessionUser } from "./types";
import { ProjectCycleTag } from "./ProjectCycleTag";
import {
  filterProjects,
  getProjectMetadata,
  projectFilterError,
  projectFilterKeys,
  projectSortOptions,
  readProjectFilters,
} from "./projectFilters";
import { LiteratureSpace, isLiteratureProject } from "./LiteratureSpace";
import { WorldSpace } from "./WorldSpace";
import { isWorldProject } from "./worldModel";
import { LivelihoodSpace } from "./LivelihoodSpace";
import { isLivelihoodProject } from "./livelihoodModel";
import { ResearchSpace } from "./ResearchSpace";
import { isResearchProject } from "./researchModel";
import { PrecisionBriefSpace } from "./PrecisionBriefSpace";
import { isPrecisionBriefProject } from "./precisionBriefModel";
import { MrnaResearchSpace, isMrnaProject } from "./MrnaResearchSpace";
import { CompareSpace } from "./CompareSpace";
import { isCompareProject } from "./compareModel";
import { InvestmentSpace } from "./InvestmentSpace";
import { isInvestmentProject } from "./investmentModel";
import { HealthSpace } from "./HealthSpace";
import { isHealthProject } from "./healthModel";
import { EnglishSpace } from "./EnglishSpace";
import { isEnglishProject } from "./englishModel";
import { SharePage } from "./SharePage";
import { ShareLinkButton } from "./ShareLinkButton";
import {
  isCastleProject,
  castleProjectTitle,
  isProject,
  projectFolder,
  folderNavigationPath,
  projectStats,
} from "./projectNavigation";
import {
  Brand,
  PersonalMotto,
  SceneNavigator,
  ContentBody,
  ErrorMessage,
  TypeIcon,
  TopicPills,
  ProfessionalGrowthDashboard,
} from "./components";
import {
  type Content,
  type Role,
  type ContentType,
  flatten,
  typeNames,
  scenes,
  projectCycles,
} from "./types";

export function App() {
  const location = useLocation();
  if (location.pathname.startsWith('/share/') || location.pathname.startsWith('/s/')) return <Routes>
    <Route path="/s/:token" element={<SharePage key={location.pathname} />} />
    <Route path="/share/:token" element={<SharePage key={location.pathname} />} />
  </Routes>;
  return <LibraryApp />;
}

function LibraryApp() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const role = user?.role;
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const contentRequest = useRef(0);
  const navigate = useNavigate();
  const check = async () => {
    setChecking(true);
    setAuthError("");
    try {
      setUser((await api<{ user: SessionUser }>("/auth/me")).user);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        setAuthError("暂时无法连接资料库");
    } finally {
      setChecking(false);
    }
  };
  const reload = async () => {
    const ticket = ++contentRequest.current;
    setLoading(true);
    setError("");
    try {
      const next = await api<Content[]>("/contents");
      if (ticket === contentRequest.current) setItems(next);
    } catch (error) {
      if (ticket === contentRequest.current) {
        setItems([]);
        setError(error instanceof Error ? error.message : "加载失败");
      }
    } finally {
      if (ticket === contentRequest.current) setLoading(false);
    }
  };
  useEffect(() => {
    void check();
    const expired = () => {
      ++contentRequest.current;
      setUser(null);
      setItems([]);
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    void reload();
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [user]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      ++contentRequest.current;
      setUser(null);
      setItems([]);
      navigate("/login");
    } catch (error) {
      setError(error instanceof Error ? error.message : "退出失败");
    }
  }
  function updateProject(updated: Content) {
    const replace = (rows: Content[]): Content[] =>
      rows.map((item) => ({
        ...item,
        ...(item.id === updated.id ? updated : {}),
        ...(item.children ? { children: replace(item.children) } : {}),
      }));
    setItems((current) => replace(current));
  }
  if (checking)
    return (
      <div className="initial-loading">
        <Brand />
        <span className="muted">正在打开资料库…</span>
      </div>
    );
  if (authError)
    return (
      <div className="initial-loading">
        <Brand />
        <ErrorMessage message={authError} />
        <button className="button" onClick={check}>
          <RefreshCw size={16} />
          重新连接
        </button>
      </div>
    );
  if (user?.mustChangePassword)
    return (
      <PasswordChange
        forced
        onChanged={() => {
          setUser(null);
          setItems([]);
          navigate("/login");
        }}
      />
    );
  return (
    <Routes>
      <Route path="/share/:token" element={<SharePage />} />
      <Route
        path="/login"
        element={
          role ? (
            <Navigate to="/home" replace />
          ) : (
            <Login
              onLogin={(next) => {
                ++contentRequest.current;
                setItems([]);
                setUser(next);
              }}
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : (
            <Shell
              role={user.role}
              user={user}
              items={items}
              loading={loading}
              error={error}
              reload={reload}
              logout={logout}
              onProjectSaved={updateProject}
            />
          )
        }
      />
    </Routes>
  );
}

function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);
  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(session.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录失败");
      if (error instanceof ApiError && error.retryAfter) {
        setLockedUntil(Date.now() + error.retryAfter * 1000);
        setNow(Date.now());
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <header>
        <Brand />
        <span className="private-note">
          <LockKeyhole size={14} /> 受控内容空间
        </span>
      </header>
      <main className="login-main">
        <div className="login-symbol">
          <LockKeyhole size={30} />
        </div>
        <p className="eyebrow">江湖行者 · VAULTVIEW</p>
        <h1>观澜</h1>
        <p className="login-subtitle">
          行走江湖，藏有所思，
          <br />
          览有所见。
        </p>
        <PersonalMotto />
        <form onSubmit={submit}>
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            maxLength={64}
            className="account-input"
          />
          <label htmlFor="password">密码</label>
          <div className="password-input">
            <LockKeyhole size={17} />
            <input
              id="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              maxLength={256}
            />
            <button
              className="icon-button"
              type="button"
              title={visible ? "隐藏密码" : "显示密码"}
              aria-label={visible ? "隐藏密码" : "显示密码"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <ErrorMessage message={error} />
          <button
            className="button primary login-submit"
            disabled={busy || remaining > 0}
          >
            {remaining > 0
              ? `${remaining} 秒后重试`
              : busy
                ? "正在验证…"
                : "打开观澜"}
            <ArrowRight size={18} />
          </button>
          <p className="login-footnote">
            <ShieldCheck size={14} /> 登录状态保留 30 天
          </p>
        </form>
      </main>
      <footer>
        VaultView <span>藏一路所学，览天地万象。</span>
      </footer>
    </div>
  );
}

type ShellProps = {
  role: Role;
  user: SessionUser;
  items: Content[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  onProjectSaved: (project: Content) => void;
};

const projectSummaries: Record<string, string> = {
  [castleProjectTitle]: "以基本信息为共同依据，安排通识学习、专业成长与运动习惯。",
  "项目01｜中国高铁运行现状及盈亏分析":
    "围绕路线、车次、客流、成本和盈亏口径，建立一份可复核的中国高铁运行研究。",
  "项目02｜mRNA 肿瘤药物研究及开发进展":
    "从基础机制、递送技术到药物管线和诊疗路径，梳理 mRNA 肿瘤药物的研究进展。",
  "滋味生活｜游｜南京高铁三小时圈":
    "以南京为出发点，按季节、时间周期、热门度和人文/自然构成，组织近郊到远途的旅行目的地。",
  "AI应用 | AI 使用技能及技巧分享｜系列课程":
    "把 AI 使用方法组织成思维导图、课程文档、课件、长图和动画视频五种展示形态。",
  "AI应用 | 第二期：少花 Token，多干活｜AI 工作效率训练营":
    "从省额度、沉淀做法到 Git、工具选择和交付评审，用七天实战建立可复用的 AI 工作流。",
};

const projectDateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const projectDateTimeFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatProjectDate(value: string, includeTime = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "未记录"
    : (includeTime ? projectDateTimeFormat : projectDateFormat).format(date);
}

function SpaceOverview({
  projects,
  contentCount,
  onOpen,
  role,
  onProjectSaved,
}: {
  projects: Content[];
  contentCount: number;
  onOpen: (project: Content) => void;
  role: Role;
  onProjectSaved: (project: Content) => void;
}) {
  const [params, setParams] = useSearchParams();
  const filters = readProjectFilters(params);
  const filterError = projectFilterError(filters);
  const visibleProjects = filterProjects(projects, filters);
  const updateFilter = (
    key: (typeof projectFilterKeys)[number],
    value: string,
  ) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "q" });
  };
  const resetFilters = () => {
    const next = new URLSearchParams(params);
    projectFilterKeys.forEach((key) => next.delete(key));
    setParams(next);
  };
  const hasDateFilters = Boolean(
    filters.createdFrom ||
    filters.createdTo ||
    filters.updatedFrom ||
    filters.updatedTo,
  );
  return (
    <section className="space-overview" aria-labelledby="space-overview-title">
      <div className="overview-hero">
        <img
          className="overview-landscape"
          src="/images/jianghu-landscape.webp"
          alt="青绿山水间，一名戴笠游侠沿石径远行"
          width={2172}
          height={724}
          loading="eager"
        />
        <div>
          <p className="eyebrow">行者手记 · VAULTVIEW</p>
          <h1 id="space-overview-title">
            观澜<span className="hero-title-note">一名游侠的见闻与作品</span>
          </h1>
          <p className="overview-lead">
            藏一路所学，览天地万象。
            <br />
            记下研究、行旅与实践，与同路人分享所得。
          </p>
          <PersonalMotto />
          <span className="motto-origin">处世自勉 · 化用《孟子·尽心上》</span>
        </div>
        <span className="hero-seal" aria-hidden="true">
          行<br />远
        </span>
      </div>
      <div className="overview-stats" aria-label="空间概览统计">
        <div>
          <strong>{projects.length}</strong>
          <span>个项目</span>
        </div>
        <div>
          <strong>{contentCount}</strong>
          <span>份内容</span>
        </div>
        <div>
          <strong>{scenes.length}</strong>
          <span>个场景</span>
        </div>
      </div>
      <div className="overview-section-heading">
        <div>
          <p className="eyebrow">行有所记 · 学有所成</p>
          <h2>项目列表</h2>
        </div>
        <span className="muted" role="status">
          {visibleProjects.length} / {projects.length} 个项目
        </span>
      </div>
      <div className="project-list-toolbar" aria-label="项目搜索筛选与排序">
        <label className="project-list-search">
          <Search size={16} />
          <input
            aria-label="搜索项目"
            placeholder="搜索项目名称、标签、类型或日期"
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
          />
          {filters.q && (
            <button
              className="icon-button"
              title="清除项目搜索"
              aria-label="清除项目搜索"
              onClick={() => updateFilter("q", "")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <label className="project-list-select">
          <span>项目类型</span>
          <select
            aria-label="项目类型"
            value={filters.scene}
            onChange={(event) => updateFilter("scene", event.target.value)}
          >
            <option value="">全部类型</option>
            {scenes.map((scene) => (
              <option key={scene.key} value={scene.key}>
                {scene.label}
              </option>
            ))}
          </select>
        </label>
        <label className="project-list-select">
          <span>排序</span>
          <select
            aria-label="项目排序字段"
            value={filters.sort}
            onChange={(event) => updateFilter("sort", event.target.value)}
          >
            {projectSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button project-list-icon"
          title={
            filters.order === "desc"
              ? "当前降序，切换为升序"
              : "当前升序，切换为降序"
          }
          aria-label={filters.order === "desc" ? "切换为升序" : "切换为降序"}
          onClick={() =>
            updateFilter("order", filters.order === "desc" ? "asc" : "desc")
          }
        >
          {filters.order === "desc" ? (
            <ArrowDownWideNarrow size={18} />
          ) : (
            <ArrowUpNarrowWide size={18} />
          )}
        </button>
        <button
          className="icon-button project-list-icon"
          title="重置搜索、筛选和排序"
          aria-label="重置搜索、筛选和排序"
          onClick={resetFilters}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <details
        className="project-date-filters"
        open={hasDateFilters || undefined}
      >
        <summary>
          <Filter size={14} />
          日期筛选{hasDateFilters && <span>已设置</span>}
          <ChevronRight size={14} />
        </summary>
        <div className="project-date-grid">
          <fieldset>
            <legend>创建时间</legend>
            <label>
              开始日期
              <input
                type="date"
                aria-label="创建时间开始日期"
                value={filters.createdFrom}
                max={filters.createdTo || undefined}
                onChange={(event) =>
                  updateFilter("createdFrom", event.target.value)
                }
              />
            </label>
            <span className="date-range-divider">至</span>
            <label>
              结束日期
              <input
                type="date"
                aria-label="创建时间结束日期"
                value={filters.createdTo}
                min={filters.createdFrom || undefined}
                onChange={(event) =>
                  updateFilter("createdTo", event.target.value)
                }
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>更新时间</legend>
            <label>
              开始日期
              <input
                type="date"
                aria-label="更新时间开始日期"
                value={filters.updatedFrom}
                max={filters.updatedTo || undefined}
                onChange={(event) =>
                  updateFilter("updatedFrom", event.target.value)
                }
              />
            </label>
            <span className="date-range-divider">至</span>
            <label>
              结束日期
              <input
                type="date"
                aria-label="更新时间结束日期"
                value={filters.updatedTo}
                min={filters.updatedFrom || undefined}
                onChange={(event) =>
                  updateFilter("updatedTo", event.target.value)
                }
              />
            </label>
          </fieldset>
        </div>
      </details>
      <ErrorMessage message={filterError} />
      {!visibleProjects.length && (
        <div className="empty project-list-empty">
          <Search size={25} />
          <h3>{projects.length ? "没有匹配的项目" : "暂无项目"}</h3>
          <button className="button" onClick={resetFilters}>
            <RotateCcw size={15} />
            清空筛选条件
          </button>
        </div>
      )}
      <div className="project-grid">
        {visibleProjects.map((project) => {
          const scene = scenes.find((item) => item.key === project.scene);
          const firstContent = project.children?.[0];
          const { updatedAt, topics } = getProjectMetadata(project);
          return (
            <article className="project-card" key={project.id}>
              <div className="project-card-topline">
                <span className="project-icon">
                  <FolderOpen size={18} />
                </span>
                <span className="scene-label" data-scene={project.scene}>
                  {scene?.label || "内容项目"}
                </span>
                <span className="project-count">
                  {projectStats(project).folders > 0 &&
                    `${projectStats(project).folders} 个板块 · `}
                  {projectStats(project).documents} 份资料
                </span>
              </div>
              <h3>{project.title.replace(/^项目\d+｜/, "")}</h3>
              <p>
                {projectSummaries[project.title] ||
                  project.description.replace(/<!--[\s\S]*?-->/g, "").trim() ||
                  "这是一个持续整理中的内容项目，包含可阅读、可观看和可复用的资料。"}
              </p>
              <div className="project-card-footer">
                <div className="project-card-metadata">
                  <span className="project-card-date">
                    <span>创建时间</span>
                    <time dateTime={project.createdAt} title="北京时间">
                      {formatProjectDate(project.createdAt)}
                    </time>
                  </span>
                  <span className="project-card-date">
                    <span>更新时间</span>
                    <time
                      dateTime={updatedAt}
                      title="项目及资料的最近修改时间（北京时间，精确到分钟）"
                    >
                      {formatProjectDate(updatedAt, true)}
                    </time>
                  </span>
                  <span className="project-card-topics">
                    <span>项目标签</span>
                    {topics.length ? (
                      <span className="topic-pills">
                        <ProjectCycleTag
                          project={project}
                          editable={role === "admin"}
                          onSaved={onProjectSaved}
                        />
                        <TopicPills topics={topics.slice(1)} />
                      </span>
                    ) : (
                      <span>暂无标签</span>
                    )}
                  </span>
                </div>
                <button
                  className="text-link"
                  disabled={!firstContent}
                  onClick={() => onOpen(project)}
                >
                  查看项目 <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const sceneLabels: Record<string, string> = {
  system: "系统管理",
  tools: "工具方法",
  life: "生活场景",
  work: "事业工作",
  hobbies: "兴趣爱好",
  other: "其他模块",
};

function ProjectOverview({
  project,
  folder,
  onOpenContent,
  onBack,
  role,
  onProjectSaved,
  onOpenPlans,
}: {
  project: Content;
  folder?: Content | null;
  onOpenContent: (content: Content) => void;
  onBack: () => void;
  role: Role;
  onProjectSaved: (project: Content) => void;
  onOpenPlans: () => void;
}) {
  const current = folder || project;
  const children = current.children || [];
  const stats = projectStats(current);
  const castle = isCastleProject(project);
  const sectionIcons: Record<string, typeof GraduationCap> = { 基本信息: UserRound, 通识: GraduationCap, 专业: FlaskConical, 运动: Dumbbell };
  const topics = folder?.topics?.length
    ? folder.topics
    : project.topics?.length
      ? project.topics
      : Array.from(
          new Set(flatten([current]).flatMap((item) => item.topics || [])),
        );
  const sceneLabel = sceneLabels[project.scene] || "内容项目";
  const summary =
    (folder
      ? folder.description
      : projectSummaries[project.title] || project.description) ||
    "这是一个持续整理中的内容项目，包含可阅读、可观看和可复用的资料。";
  return (
    <section
      className={`project-overview project-overview-${project.scene}`}
      aria-labelledby="project-overview-title"
    >
      <div className="project-overview-toolbar">
        <button className="back-link" onClick={onBack}>
          <ChevronRight size={15} className="back-link-icon" />
          {folder
            ? `返回${project.title.replace(/^项目\d+｜/, "")}`
            : "返回空间概览"}
        </button>
        <span className="project-space-label">
          <Compass size={14} /> 独立项目空间
        </span>
      </div>
      <header className="project-overview-hero">
        <div className="project-overview-copy">
          <div className="project-overview-kicker">
            <span className="project-overview-icon">
              <FolderOpen size={19} />
            </span>
            <span>{sceneLabel}</span>
            <span className="project-overview-status">持续更新</span>
          </div>
          <h1 id="project-overview-title">
            {current.title.replace(/^项目\d+｜/, "")}
          </h1>
          <p>{summary}</p>
          <div className="project-topic-row">
            {!folder && isProject(project) && (
              <ProjectCycleTag
                project={project}
                editable={role === "admin"}
                onSaved={onProjectSaved}
              />
            )}
            <TopicPills
              topics={!folder && isProject(project) ? topics.slice(1) : topics}
            />
          </div>
        </div>
        <div className="project-overview-emblem" aria-hidden="true">
          <Layers3 size={32} />
          <span>PROJECT SPACE</span>
        </div>
      </header>
      <div className="project-overview-stats">
        <div>
          <strong>{stats.documents}</strong>
          <span>份资料</span>
        </div>
        <div>
          <strong>{stats.formats}</strong>
          <span>种展示形态</span>
        </div>
        <div>
          <strong>{topics.length}</strong>
          <span>个项目标签</span>
        </div>
        <div>
          <strong>{stats.folders || <BarChart3 size={18} />}</strong>
          <span>{stats.folders ? "个板块目录" : "可持续迭代"}</span>
        </div>
      </div>
      <div className="project-overview-heading">
        <div>
          <p className="eyebrow">PROJECT NAVIGATION</p>
          <h2>
            {folder
              ? folder.title === "专业"
                ? "专业成长工作台"
                : "板块资料"
              : castle
                ? "生活板块"
                : "项目导览"}
          </h2>
        </div>
      </div>
      {folder?.title === "专业" && (
        <ProfessionalGrowthDashboard
          modules={children}
          onOpenModule={onOpenContent}
        />
      )}
      <div className="project-content-grid">
        {isCompareProject(project) && !folder && (
          <button
            className="project-content-card project-plans-card"
            type="button"
            onClick={() => {
              window.location.href = `/compare?project=${project.id}`;
            }}
          >
            <span className="project-content-index">00</span>
            <span className="project-content-type plans">
              <Search size={17} />
            </span>
            <span className="project-content-main">
              <strong>开始比价</strong>
              <span>输入商品需求，比较不同平台的到手价与服务</span>
              <span className="project-content-meta">
                <Search size={12} /> 比价工作台{" "}
                <span className="project-plan-hint">点击进入</span>
              </span>
            </span>
            <ArrowRight size={17} className="project-content-arrow" />
          </button>
        )}
        {isTravelProject(project) && !folder && (
          <button
            className="project-content-card project-plans-card"
            type="button"
            onClick={onOpenPlans}
          >
            <span className="project-content-index">00</span>
            <span className="project-content-type plans">
              <CalendarDays size={17} />
            </span>
            <span className="project-content-main">
              <strong>我的安排</strong>
              <span>记录每一次出行计划，查看图文行程</span>
              <span className="project-content-meta">
                <CalendarDays size={12} /> 行程管理
                <span className="project-plan-hint">点击进入</span>
              </span>
            </span>
            <ArrowRight size={17} className="project-content-arrow" />
          </button>
        )}
        {children.map((content, index) => {
          const SectionIcon =
            castle && !folder ? sectionIcons[content.title] || FolderOpen : null;
          return (
            <button
              className={`project-content-card ${index === 0 ? "featured" : ""}`}
              key={content.id}
              onClick={() => onOpenContent(content)}
            >
              <span className="project-content-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={`project-content-type ${content.type}`}>
                {SectionIcon ? (
                  <SectionIcon size={17} />
                ) : (
                  <TypeIcon type={content.type} size={17} />
                )}
              </span>
              <span className="project-content-main">
                <strong>{content.title.replace(/^\d+\s*/, "")}</strong>
                <span>
                  {(
                    content.description
                      .split("\n")
                      .find((line) => line.trim() && !line.trim().startsWith("<!--")) || typeNames[content.type]
                  ).replace(/^#{1,6}\s*/, "")}
                </span>
                <span className="project-content-meta">
                  <CalendarDays size={12} /> {typeNames[content.type]}{" "}
                  {content.type === "folder" &&
                    `${projectStats(content).documents} 份资料 `}
                  <TopicPills topics={content.topics} />
                </span>
              </span>
              <ArrowRight size={17} className="project-content-arrow" />
            </button>
          );
        })}
      </div>
      {!children.length && <div className="empty">暂无资料</div>}
    </section>
  );
}

type NetworkMode = "all" | "scene" | "topic";

function ContentNetwork({
  projects,
  onOpen,
}: {
  projects: Content[];
  onOpen: (project: Content) => void;
}) {
  const [mode, setMode] = useState<NetworkMode>("all");
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const rows = projects.map((project) => {
    const documents = flatten(project.children || []).filter(
      (item) => item.type !== "folder",
    );
    const topics = [
      ...new Set([
        ...(project.topics || []),
        ...documents.flatMap((item) => item.topics || []),
      ]),
    ].slice(0, 5);
    return { project, documents, topics };
  });
  const sceneName = (scene: string) =>
    scenes.find((item) => item.key === scene)?.label || "其他模块";
  const relations = rows.flatMap((left, leftIndex) =>
    rows.slice(leftIndex + 1).flatMap((right) => {
      const sharedTopics = left.topics.filter((topic) =>
        right.topics.includes(topic),
      );
      const sameScene = left.project.scene === right.project.scene;
      if (mode === "scene" && !sameScene) return [];
      if (mode === "topic" && !sharedTopics.length) return [];
      if (!sameScene && !sharedTopics.length) return [];
      return [
        {
          left: left.project.id,
          right: right.project.id,
          label: sharedTopics.length
            ? `#${sharedTopics[0]}`
            : sceneName(left.project.scene),
        },
      ];
    }),
  );
  const positions = rows.map((_, index) => {
    const angle =
      -Math.PI / 2 + (index / Math.max(rows.length, 1)) * Math.PI * 2;
    return {
      x: 50 + Math.cos(angle) * 37,
      y: 50 + Math.sin(angle) * 35,
    };
  });
  const relationFor = (projectId: number) =>
    relations.filter(
      (relation) => relation.left === projectId || relation.right === projectId,
    );
  return (
    <section className="content-network" aria-labelledby="network-title">
      <div className="network-heading">
        <div>
          <p className="eyebrow">CONTENT RELATION NETWORK</p>
          <h1 id="network-title">内容关系网</h1>
          <p className="muted">
            用场景、主题和项目内容建立发散索引，从一个项目找到下一条路径。
          </p>
        </div>
        <div className="network-summary">
          <strong>{rows.length}</strong>
          <span>个项目 · {relations.length} 条关联</span>
        </div>
      </div>
      <div className="network-toolbar">
        <div className="network-modes" aria-label="关系筛选">
          <button
            className={mode === "all" ? "active" : ""}
            onClick={() => setMode("all")}
          >
            <Network size={15} /> 全部关系
          </button>
          <button
            className={mode === "scene" ? "active" : ""}
            onClick={() => setMode("scene")}
          >
            <Link2 size={15} /> 同一场景
          </button>
          <button
            className={mode === "topic" ? "active" : ""}
            onClick={() => setMode("topic")}
          >
            <Tags size={15} /> 共享主题
          </button>
        </div>
        <span className="muted network-hint">
          点击节点聚焦关联，点击“打开项目”进入项目空间
        </span>
      </div>
      <div className="network-stage">
        <svg className="network-lines" viewBox="0 0 100 100" aria-hidden="true">
          {positions.map((position, index) => (
            <line
              key={`hub-${rows[index].project.id}`}
              x1="50"
              y1="50"
              x2={position.x}
              y2={position.y}
              className={
                focusedId === null || focusedId === rows[index].project.id
                  ? "network-line active"
                  : "network-line"
              }
            />
          ))}
          {relations.map((relation) => {
            const leftIndex = rows.findIndex(
              (row) => row.project.id === relation.left,
            );
            const rightIndex = rows.findIndex(
              (row) => row.project.id === relation.right,
            );
            const highlighted =
              focusedId === null ||
              focusedId === relation.left ||
              focusedId === relation.right;
            return (
              <line
                key={`${relation.left}-${relation.right}`}
                x1={positions[leftIndex].x}
                y1={positions[leftIndex].y}
                x2={positions[rightIndex].x}
                y2={positions[rightIndex].y}
                className={
                  highlighted
                    ? "network-line relation active"
                    : "network-line relation"
                }
              />
            );
          })}
        </svg>
        <div className="network-hub">
          <Network size={22} />
          <strong>观澜空间</strong>
          <span>项目 · 场景 · 主题</span>
        </div>
        {rows.map(({ project, documents, topics }, index) => {
          const position = positions[index];
          const isFocused = focusedId === project.id;
          const connected = relationFor(project.id).length;
          return (
            <article
              className={`network-node ${isFocused ? "focused" : ""}`}
              key={project.id}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <button
                className="network-node-focus"
                aria-pressed={isFocused}
                onClick={() => setFocusedId(isFocused ? null : project.id)}
              >
                <span className="network-node-kicker">
                  <span>{sceneName(project.scene)}</span>
                  <span>{connected} 条关联</span>
                </span>
                <strong>{project.title.replace(/^项目\d+｜/, "")}</strong>
                <span className="network-node-meta">
                  {documents.length} 份资料 ·{" "}
                  {topics
                    .slice(0, 2)
                    .map((topic) => `#${topic}`)
                    .join(" ") || "待补主题"}
                </span>
              </button>
              <button className="network-open" onClick={() => onOpen(project)}>
                打开项目 <ArrowRight size={14} />
              </button>
            </article>
          );
        })}
      </div>
      <div className="network-footnote">
        <span>
          <Link2 size={14} /> 中心线表示项目归属于观澜空间
        </span>
        <span>
          <Tags size={14} /> 项目线表示共享场景或 topics
        </span>
      </div>
    </section>
  );
}

function Shell({
  role,
  user,
  items,
  loading,
  error,
  reload,
  logout,
  onProjectSaved,
}: ShellProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const all = flatten(items);
  const leaves = all.filter((item) => item.type !== "folder");
  const projects = all
    .filter(isProject)
    .sort((a, b) => b.sortOrder - a.sortOrder);
  const projectId = Number(params.get("project")) || null;
  const project = projects.find((item) => item.id === projectId) || null;
  const folderId = Number(params.get("folder")) || null;
  const folder = project
    ? projectFolder(project, folderId)
    : all.find((item) => item.id === folderId && item.type === "folder") ||
      null;
  const parentFolder =
    project && folder && folder.parentId !== project.id
      ? projectFolder(project, folder.parentId)
      : null;
  const isNetwork = location.pathname === "/network";
  const isCompare = location.pathname === "/compare";
  const isInvestment = location.pathname === "/invest";
  const isUsers = location.pathname === "/admin/users";
  const isAccount = location.pathname === "/account";
  const overview =
    !params.get("id") &&
    !project &&
    !folder &&
    !search &&
    !isNetwork &&
    !isCompare &&
    !isInvestment &&
    !location.pathname.startsWith("/admin") &&
    !isAccount;
  const selectedId = Number(params.get("id")) || null;
  const selected = all.find(
    (item) => item.id === selectedId && item.type !== "folder",
  );
  const isAdmin = location.pathname === "/admin";
  const choose = (id: number) => {
    const literatureOwner = projects.find(
      (candidate) =>
        isLiteratureProject(candidate) &&
        flatten(candidate.children || []).some((content) => content.id === id),
    );
    navigate(
      literatureOwner
        ? `/home?project=${literatureOwner.id}&view=documents&doc=${id}`
        : `/home?id=${id}`,
    );
    setMobileMenu(false);
    setSearch("");
  };
  const openProject = (projectToOpen: Content) => {
    navigate(folderNavigationPath(projects, projectToOpen));
    setMobileMenu(false);
    setSearch("");
  };
  useEffect(() => {
    if (project && params.has("folder") && !folder && !loading) {
      const next = new URLSearchParams(params);
      next.delete("folder");
      setParams(next, { replace: true });
    }
  }, [project, folder, loading, params, setParams]);
  const lastLogged = useRef<number | null>(null);
  useEffect(() => {
    if (selected && !isAdmin && !search && lastLogged.current !== selected.id) {
      lastLogged.current = selected.id;
      void api("/log", {
        method: "POST",
        body: JSON.stringify({
          contentId: selected.id,
          action: `view_${selected.type}`,
        }),
      }).catch(() => {});
    }
  }, [selected, isAdmin, search]);
  const parent = all.find((item) => item.id === selected?.parentId);
  const activeProject = projects.find((candidate) =>
    flatten(candidate.children || []).some(
      (content) => content.id === selectedId,
    ),
  );
  const projectContents = activeProject
    ? flatten(activeProject.children || []).filter(
        (content) => content.type !== "folder",
      )
    : [];
  const learningProject = project && isCastleProject(project) ? project : activeProject && isCastleProject(activeProject) ? activeProject : null;
  const learningTarget = folder || selected;
  const travelProject = isTravelProject(project)
    ? project
    : isTravelProject(activeProject)
      ? activeProject
      : null;
  const plansView = Boolean(
    travelProject && project && params.get("view") === "plans",
  );
  const travelTabs = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = travelTabs.current;
    if (!nav) return;
    const reveal = () => {
      const selectedTab = nav.querySelector<HTMLElement>(".selected");
      if (!selectedTab) return;
      const tabRect = selectedTab.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      if (tabRect.right > navRect.right)
        nav.scrollLeft += tabRect.right - navRect.right;
      else if (tabRect.left < navRect.left)
        nav.scrollLeft -= navRect.left - tabRect.left;
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    reveal();
    return () => observer.disconnect();
  }, [selectedId, plansView, projectId, travelProject?.id]);
  const currentIndex = leaves.findIndex((item) => item.id === selectedId);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/home" aria-label="观澜首页">
            <Brand />
          </Link>
          <button
            className="icon-button mobile-only"
            title="关闭导航"
            aria-label="关闭导航"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">
            <Compass size={19} />
          </span>
          <div>
            <strong>江湖行者</strong>
            <small>以所学修身，以所得助人</small>
          </div>
          <LockKeyhole size={14} />
        </div>
        <nav>
          <Link
            className={`nav-link ${overview ? "active" : ""}`}
            to="/home"
            onClick={() => setMobileMenu(false)}
          >
            <Library size={18} /> 空间概览 <span>{projects.length}</span>
          </Link>
          <details
            className={`sidebar-tools ${isNetwork || isAdmin || isUsers ? "has-active" : ""}`}
          >
            <summary>
              <Settings2 size={17} aria-hidden="true" />
              <span>更多功能</span>
              <ChevronRight
                size={15}
                className="sidebar-tools-chevron"
                aria-hidden="true"
              />
            </summary>
            <div className="sidebar-tools-links">
              <Link
                className={`nav-link ${isNetwork ? "active" : ""}`}
                to="/network"
                onClick={() => setMobileMenu(false)}
              >
                <Network size={18} /> 关系网 <span>{projects.length}</span>
              </Link>
              {role === "admin" && (
                <Link
                  className={`nav-link ${isAdmin ? "active" : ""}`}
                  to="/admin"
                  onClick={() => setMobileMenu(false)}
                >
                  <Settings2 size={18} /> 内容管理
                </Link>
              )}
              {role === "admin" && (
                <Link
                  className={`nav-link ${isUsers ? "active" : ""}`}
                  to="/admin/users"
                  onClick={() => setMobileMenu(false)}
                >
                  <ShieldCheck size={18} /> 用户与授权
                </Link>
              )}
            </div>
          </details>
        </nav>
        <div className="tree-heading">
          资料目录{" "}
          <span>{items.filter((item) => item.type === "folder").length}</span>
        </div>
        <div className="tree-scroll">
          <SceneNavigator
            items={items}
            selected={
              isAdmin || overview
                ? null
                : selectedId ||
                  Number(params.get("doc")) ||
                  folder?.id ||
                  Number(params.get("issue")) ||
                  project?.id ||
                  null
            }
            onSelect={choose}
            onOpenFolder={openProject}
          />
          {!items.length && !loading && (
            <p className="muted sidebar-empty">暂无目录</p>
          )}
        </div>
        <div className="sidebar-creed">
          <span>行走有界，心有山河</span>
          <PersonalMotto compact />
        </div>
        <div className="sidebar-bottom">
          <span className="session-avatar">
            {role === "admin" ? "管" : role === "share" ? "享" : "访"}
          </span>
          <div>
            <strong title={user.username}>{user.username}</strong>
            <small>{role === "admin" ? "管理员" : role === "share" ? "分享浏览" : "访问者"}</small>
          </div>
          {role !== 'share' && <Link
            to="/account"
            className="icon-button"
            title="修改密码"
            aria-label="修改密码"
          >
            <LockKeyhole size={17} />
          </Link>}
          <button
            className="icon-button"
            title="退出登录"
            aria-label="退出登录"
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="关闭导航"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <strong className="mobile-only mobile-brand">观澜</strong>
          <button
            className="icon-button mobile-only"
            title="打开导航"
            aria-label="打开导航"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            <span>观澜空间</span>
            <ChevronRight size={14} />
            <strong>
              {isUsers
                ? "用户与授权"
                : isAccount
                  ? "修改密码"
                  : isNetwork
                    ? "关系网"
                    : isInvestment
                      ? "投资理财"
                    : isCompare
                      ? "消费比价"
                      : isAdmin
                        ? "内容管理"
                        : folder
                          ? project
                            ? `${project.title} / ${folder.title}`
                            : folder.title
                          : activeProject
                            ? `${activeProject.title.replace(/^项目\d+｜/, "")}${parent?.type === "folder" ? ` / ${parent.title}` : ""}`
                            : project?.title ||
                              scenes.find(
                                (scene) => scene.key === selected?.scene,
                              )?.label ||
                              parent?.title ||
                              "空间概览"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="private-note">
              <LockKeyhole size={13} /> 项目授权访问
            </span>
            <span className="tiny-avatar">
              {role === "admin" ? "管" : role === "share" ? "享" : "访"}
            </span>
          </div>
        </header>
        <main className="main-content">
          {role !== 'share' && !isAdmin && !isUsers && !isAccount && !isInvestment && !(isInvestmentProject(project) && !folder) && !loading && !error && (
            <div className="share-toolbar" aria-label="页面分享">
              {(folder || project || activeProject)?.type === 'folder' && <ShareLinkButton
                key={`project-${(folder || project || activeProject)!.id}`}
                label={folder ? '分享此板块' : '分享项目'}
                target={{ kind: 'project', contentId: (folder || project || activeProject)!.id }} />}
              <ShareLinkButton key={`page-${location.pathname}-${params.toString()}`} target={
                selected ? { kind: 'content', contentId: selected.id }
                  : plansView && Number(params.get('trip')) ? { kind: 'trip', projectId: travelProject!.id, tripId: Number(params.get('trip')) }
                    : { kind: 'page', contentId: (folder || project)?.id, title: folder?.title || project?.title || (isNetwork ? '项目关系网' : '空间概览') }
              } label="分享当前页面" />
            </div>
          )}
          <ErrorMessage message={error} />
          {error && (
            <button className="button" onClick={reload}>
              <RefreshCw size={15} />
              重新加载
            </button>
          )}
          {travelProject &&
            !isAdmin &&
            !isUsers &&
            !isAccount &&
            !isNetwork &&
            !search && (
              <nav
                ref={travelTabs}
                className="project-content-tabs travel-project-tabs"
                aria-label="周边游项目切换"
              >
                <button
                  className={project && !plansView ? "selected" : ""}
                  aria-current={project && !plansView ? "page" : undefined}
                  onClick={() => openProject(travelProject)}
                >
                  <Library size={16} /> 项目概览
                </button>
                <button
                  className={plansView ? "selected" : ""}
                  aria-current={plansView ? "page" : undefined}
                  onClick={() => {
                    setSearch("");
                    navigate(`/home?project=${travelProject.id}&view=plans`);
                  }}
                >
                  <CalendarDays size={16} /> 我的安排
                </button>
                {flatten(travelProject.children || [])
                  .filter((content) => content.type !== "folder")
                  .map((content) => (
                    <button
                      key={content.id}
                      className={content.id === selectedId ? "selected" : ""}
                      aria-current={
                        content.id === selectedId ? "page" : undefined
                      }
                      onClick={() => choose(content.id)}
                    >
                      <TypeIcon type={content.type} size={16} />
                      {content.title.split("｜")[0].replace(/^\d+\s*/, "")}
                    </button>
                  ))}
              </nav>
            )}
          {!isAdmin &&
            !isNetwork &&
            !isCompare &&
            !isInvestment &&
            project &&
            (Boolean(folder) ||
              isHealthProject(project) ||
              isMrnaProject(project) ||
              isLiteratureProject(project) ||
              isWorldProject(project) ||
              isLivelihoodProject(project) ||
              isResearchProject(project) ||
              isPrecisionBriefProject(project) ||
              isCompareProject(project) || isInvestmentProject(project)) && (
              <div className="project-cycle-toolbar">
                <ProjectCycleTag
                  project={project}
                  editable={role === "admin"}
                  onSaved={onProjectSaved}
                />
                <TopicPills topics={project.topics?.slice(1) || []} />
              </div>
            )}
          {!isAdmin && !isUsers && !isAccount && !isNetwork && !loading && !error && learningProject && learningTarget &&
            learningTarget.id !== learningBasicsFolder(learningProject)?.id && learningTarget.id !== learningBasicsDocument(learningProject)?.id &&
            <LearningReference key={`${learningProject.id}-${learningTarget.id}`} project={learningProject} target={learningTarget} onOpen={openProject} />}
          {isUsers ? (
            role === "admin" ? (
              <Accounts currentUser={user} />
            ) : (
              <Navigate to="/home" replace />
            )
          ) : isAccount ? (
            role === 'share' ? <Navigate to="/home" replace /> : <PasswordChange
              onChanged={() =>
                window.dispatchEvent(new Event("session-expired"))
              }
            />
          ) : !loading &&
            !error &&
            ((projectId && !project) ||
              (selectedId && !selected) ||
              (folderId && !folder)) ? (
            <section className="empty-state">
              <LockKeyhole size={28} />
              <h2>项目不存在或暂未授权</h2>
              <Link to="/home" className="button">
                返回空间概览
              </Link>
            </section>
          ) : !loading && !error && (role === "visitor" || role === "share") && !projects.length ? (
            <section className="empty-state">
              <Library size={28} />
              <h2>暂无获授权的项目</h2>
              <p>请联系管理员为你的账号分配项目。</p>
            </section>
          ) : isInvestment ? (
            project && isInvestmentProject(project) ? (
              <InvestmentSpace key={`${user.id}-${project.id}`} project={project} onOpenDocument={choose} />
            ) : (
              <section className="empty-state"><LockKeyhole size={28} /><h2>投资项目不存在或暂未授权</h2><Link to="/home" className="button">返回空间概览</Link></section>
            )
          ) : isCompare ? (
            project && isCompareProject(project) ? (
              <CompareSpace
                key={`${project.id}-${params.get("run") || "workbench"}`}
                project={project}
                workbench
                onOpenDocument={choose}
              />
            ) : (
              <section className="empty-state">
                <LockKeyhole size={28} />
                <h2>比价项目不存在或暂未授权</h2>
                <Link to="/home" className="button">
                  返回空间概览
                </Link>
              </section>
            )
          ) : isNetwork ? (
            <ContentNetwork projects={projects} onOpen={openProject} />
          ) : isAdmin ? (
            role === "admin" ? (
              <Admin items={all} reload={reload} />
            ) : (
              <Navigate to="/home" replace />
            )
          ) : plansView && travelProject ? (
            <TripPlans
              key={`${user.id}-${travelProject.id}`}
              projectId={travelProject.id}
            />
          ) : project && isCastleProject(project) && folder && folder.id === learningBasicsFolder(project)?.id ? (
            <LearningBasics key={`${project.id}-${learningBasicsDocument(project)?.updatedAt}`} project={project} role={role} onBack={() => openProject(project)} onOpen={openProject} onSaved={reload} />
          ) : project && isCastleProject(project) && folder && isEnglishProject(folder) && parentFolder?.title === "通识" ? (
            <EnglishSpace
              key={`${user.id}-${folder.id}`}
              project={folder}
              userId={user.id}
              onBack={() => openProject(parentFolder)}
              onCastle={() => openProject(project)}
            />
          ) : project && !folder && isInvestmentProject(project) ? (
            <InvestmentSpace key={`${user.id}-${project.id}`} project={project} onOpenDocument={choose} />
          ) : project && !folder && isHealthProject(project) ? (
            <HealthSpace
              key={`${user.id}-${project.id}`}
              project={project}
              onBack={() => navigate("/home")}
            />
          ) : project && !folder && isCompareProject(project) ? (
            <CompareSpace
              key={project.id}
              project={project}
              workbench={false}
              onOpenDocument={choose}
            />
          ) : project && !folder && isPrecisionBriefProject(project) ? (
            <PrecisionBriefSpace
              key={project.id}
              project={project}
              onBack={() => navigate("/home")}
            />
          ) : project && !folder && isResearchProject(project) ? (
            <ResearchSpace
              key={project.id}
              project={project}
              onBack={() => navigate("/home")}
            />
          ) : project && !folder && isWorldProject(project) ? (
            <WorldSpace
              key={project.id}
              project={project}
              livelihood={projects.find(
                (item) => !item.navigationOnly && isLivelihoodProject(item),
              )}
              onOpen={openProject}
              onBack={() => navigate("/home")}
            />
          ) : project && !folder && isLivelihoodProject(project) ? (
            <LivelihoodSpace
              key={project.id}
              project={project}
              world={projects.find(
                (item) => !item.navigationOnly && isWorldProject(item),
              )}
              onOpen={openProject}
              onBack={() => navigate("/home")}
            />
          ) : project && !folder && isMrnaProject(project) ? (
            <MrnaResearchSpace
              key={project.id}
              project={project}
              onBack={() => navigate("/home")}
            />
          ) : project && !folder && isLiteratureProject(project) ? (
            <LiteratureSpace
              key={project.id}
              project={project}
              onBack={() => navigate("/home")}
            />
          ) : project || folder ? (
            <ProjectOverview
              project={(project || folder)!}
              role={role}
              onProjectSaved={onProjectSaved}
              folder={project ? folder : null}
              onBack={() =>
                project && folder
                  ? openProject(parentFolder || project)
                  : navigate("/home")
              }
              onOpenContent={(content) =>
                content.type === "folder"
                  ? openProject(content)
                  : choose(content.id)
              }
              onOpenPlans={() =>
                navigate(
                  `/home?project=${project?.id ?? folder?.id}&view=plans`,
                )
              }
            />
          ) : overview ? (
            loading ? (
              <div className="empty">正在加载空间概览…</div>
            ) : (
              <SpaceOverview
                projects={projects}
                role={role}
                onProjectSaved={onProjectSaved}
                contentCount={leaves.length}
                onOpen={openProject}
              />
            )
          ) : (
            <>
              <div className="library-heading">
                <div>
                  <p className="eyebrow">CONTENT SPACE</p>
                  <h1>
                    观澜空间<span>{leaves.length} 份内容</span>
                  </h1>
                  <p className="muted">收藏、整理，也让好内容被看见。</p>
                </div>
                <label className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="搜索资料"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索资料…"
                  />
                  {search && (
                    <button
                      className="icon-button"
                      title="清除搜索"
                      aria-label="清除搜索"
                      onClick={() => setSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
              </div>
              {!isTravelProject(activeProject) && (
                <div className="collection-tabs">
                  <nav
                    className="project-content-tabs"
                    aria-label="项目资料切换"
                  >
                    <button
                      onClick={() => {
                        setSearch("");
                        navigate(
                          activeProject
                            ? `/home?project=${activeProject.id}`
                            : "/home",
                        );
                      }}
                    >
                      <Library size={16} />{" "}
                      {activeProject ? "项目概览" : "空间概览"}
                    </button>
                    {!search &&
                      projectContents.map((content) => (
                        <button
                          key={content.id}
                          className={
                            content.id === selectedId ? "selected" : ""
                          }
                          aria-current={
                            content.id === selectedId ? "page" : undefined
                          }
                          title={content.title}
                          onClick={() => choose(content.id)}
                        >
                          <TypeIcon type={content.type} size={16} />
                          {content.title
                            .split("｜")[0]
                            .replace(/^\d+\s*/, "") || typeNames[content.type]}
                        </button>
                      ))}
                  </nav>
                  {!activeProject && (
                    <span>
                      {leaves.filter((item) => item.type === "video").length}{" "}
                      视频
                      <span className="dot">·</span>
                      {
                        leaves.filter(
                          (item) =>
                            item.type === "ppt" ||
                            item.type === "mindmap" ||
                            item.type === "longimage" ||
                            item.type === "pdf",
                        ).length
                      }{" "}
                      文档<span className="dot">·</span>
                      {
                        leaves.filter((item) => item.type === "text").length
                      }{" "}
                      文章
                    </span>
                  )}
                </div>
              )}
              {loading ? (
                <div className="empty">正在加载收藏…</div>
              ) : search ? (
                <div className="search-results">
                  {leaves
                    .filter((item) =>
                      `${item.title} ${item.description} ${(item.topics || []).join(" ")}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((item) => (
                      <button
                        className="result-row"
                        key={item.id}
                        onClick={() => choose(item.id)}
                      >
                        <span className={`type-square ${item.type}`}>
                          <TypeIcon type={item.type} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{typeNames[item.type]}</small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  {!leaves.some((item) =>
                    `${item.title} ${item.description} ${(item.topics || []).join(" ")}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ) && (
                    <div className="empty">
                      <Search size={28} />
                      <h3>没有找到相关资料</h3>
                      <p>换一个关键词再试试</p>
                    </div>
                  )}
                </div>
              ) : selected ? (
                <article className="detail">
                  {activeProject && (
                    <nav
                      className="detail-return-links"
                      aria-label="资料返回导航"
                    >
                      {parent?.type === "folder" &&
                        parent.id !== activeProject.id && (
                          <button
                            className="back-link"
                            onClick={() => openProject(parent)}
                          >
                            <ArrowLeft size={15} />
                            返回板块：{parent.title}
                          </button>
                        )}
                      <button
                        className="back-link"
                        onClick={() => openProject(activeProject)}
                      >
                        <House size={15} />
                        返回{activeProject.title.replace(/^项目\d+｜/, "")}
                      </button>
                    </nav>
                  )}
                  <div className="detail-heading">
                    <span className={`type-badge ${selected.type}`}>
                      <TypeIcon type={selected.type} size={14} />
                      {typeNames[selected.type]}
                    </span>
                    <TopicPills topics={selected.topics} />
                    <span className="muted">
                      {new Date(selected.updatedAt).toLocaleDateString("zh-CN")}{" "}
                      更新
                    </span>
                  </div>
                  <h2>{selected.title}</h2>
                  <ContentBody key={selected.id} content={selected} />
                  <div className="detail-bottom">
                    <span>
                      <ShieldCheck size={14} /> 私有收藏
                    </span>
                    <div>
                      <button
                        className="button subtle"
                        disabled={currentIndex <= 0}
                        onClick={() =>
                          setParams({ id: String(leaves[currentIndex - 1].id) })
                        }
                      >
                        <ArrowLeft size={16} />
                        上一篇
                      </button>
                      <button
                        className="button subtle"
                        disabled={
                          currentIndex < 0 || currentIndex === leaves.length - 1
                        }
                        onClick={() =>
                          setParams({ id: String(leaves[currentIndex + 1].id) })
                        }
                      >
                        下一篇
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="empty">
                  <FolderOpen size={35} />
                  <h3>
                    {leaves.length ? "这份资料已不存在" : "资料库还是空的"}
                  </h3>
                  <p>
                    {role === "admin"
                      ? "前往内容管理，添加第一份收藏。"
                      : "稍后再来看看。"}
                  </p>
                  {role === "admin" && (
                    <Link className="button primary" to="/admin">
                      管理资料
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>观澜 / VaultView</span>
          <span>一程山水，一程求索。</span>
        </footer>
      </div>
    </div>
  );
}

function Admin({
  items,
  reload,
}: {
  items: Content[];
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Content | "new" | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  async function remove(item: Content) {
    if (!window.confirm(`确定删除「${item.title}」？此操作无法撤销。`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await api(`/contents/${item.id}`, { method: "DELETE", body: "{}" });
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }
  return (
    <>
      <div className="library-heading admin-heading">
        <div>
          <p className="eyebrow">CONTENT MANAGEMENT</p>
          <h1>内容管理</h1>
          <p className="muted">{items.length} 项内容</p>
        </div>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          新增内容
        </button>
      </div>
      <ErrorMessage message={error} />
      <label className="search-box admin-search">
        <Search size={17} />
        <input
          aria-label="筛选内容"
          placeholder="筛选内容…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>场景</th>
              <th>标签</th>
              <th>所属目录</th>
              <th>排序</th>
              <th className="right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((item) => item.title.includes(query))
              .map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="table-title">
                      <TypeIcon type={item.type} />
                      {item.title}
                    </span>
                  </td>
                  <td>{typeNames[item.type]}</td>
                  <td>
                    {scenes.find((scene) => scene.key === item.scene)?.label ||
                      item.scene}
                  </td>
                  <td>
                    <TopicPills topics={item.topics} />
                  </td>
                  <td>
                    {items.find((parent) => parent.id === item.parentId)
                      ?.title || "根目录"}
                  </td>
                  <td>{item.sortOrder}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        title={`编辑 ${item.title}`}
                        aria-label={`编辑 ${item.title}`}
                        onClick={() => setEditing(item)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        title={`删除 ${item.title}`}
                        aria-label={`删除 ${item.title}`}
                        disabled={busyId === item.id}
                        onClick={() => remove(item)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!items.filter((item) => item.title.includes(query)).length && (
          <div className="empty">暂无匹配内容</div>
        )}
      </div>
      {editing && (
        <ContentEditor
          content={editing === "new" ? null : editing}
          items={items}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function ContentEditor({
  content,
  items,
  close,
  saved,
}: {
  content: Content | null;
  items: Content[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<ContentType>(content?.type || "text");
  const [projectRoot, setProjectRoot] = useState(content?.isProject === true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const excluded = new Set<number>();
  if (content) {
    excluded.add(content.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of items)
        if (
          item.parentId &&
          excluded.has(item.parentId) &&
          !excluded.has(item.id)
        ) {
          excluded.add(item.id);
          changed = true;
        }
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || "").trim();
    const data = {
      title: value("title"),
      type,
      isProject: type === "folder" && projectRoot,
      scene: value("scene") || "other",
      topics: (type === "folder" && projectRoot
        ? [
            value("projectCycle") || "阶段性",
            value("topics") || "project, research",
          ]
        : [value("topics") || "other"]
      )
        .flatMap((topic) => topic.split(/[\n,，]+/))
        .map((topic) => topic.trim())
        .filter(Boolean)
        .slice(0, 3),
      description: value("description"),
      parentId: value("parentId") ? Number(value("parentId")) : null,
      sortOrder: Number(value("sortOrder")),
      coverUrl: value("coverUrl") || null,
      fileUrl: value("fileUrl") || null,
      hlsUrl: value("hlsUrl") || null,
      pdfUrl: value("pdfUrl") || null,
      assetsJson: value("assetsJson")
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
      imagesJson: value("imagesJson")
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
    };
    try {
      await api(content ? `/contents/${content.id}` : "/contents", {
        method: content ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      await saved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      aria-labelledby="editor-title"
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <h2 id="editor-title">{content ? "编辑内容" : "新增内容"}</h2>
          <button
            type="button"
            className="icon-button"
            title="关闭"
            aria-label="关闭"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className="editor-fields">
          <label>
            标题
            <input
              name="title"
              autoFocus
              required
              maxLength={160}
              defaultValue={content?.title}
            />
          </label>
          <div className="form-grid">
            <label>
              类型
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as ContentType)}
              >
                {Object.entries(typeNames).map(([value, name]) => (
                  <option value={value} key={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              场景
              <select name="scene" defaultValue={content?.scene || "other"}>
                {scenes.map((scene) => (
                  <option value={scene.key} key={scene.key}>
                    {scene.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              所属目录
              <select name="parentId" defaultValue={content?.parentId || ""}>
                <option value="">根目录</option>
                {items
                  .filter(
                    (item) => item.type === "folder" && !excluded.has(item.id),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {type === "folder" && (
            <label className="account-check">
              <input
                type="checkbox"
                checked={projectRoot}
                onChange={(event) => setProjectRoot(event.target.checked)}
              />
              作为独立项目（可单独授权）
            </label>
          )}
          <label>
            {type === "folder" && projectRoot
              ? "项目标签（周期 + 2 个主题）"
              : "Topics 标签（1–2 个）"}
            {type === "folder" && projectRoot ? (
              <div className="project-topic-editor">
                <select
                  name="projectCycle"
                  defaultValue={content?.topics?.[0] || "阶段性"}
                >
                  {projectCycles.map((cycle) => (
                    <option value={cycle} key={cycle}>
                      {cycle}
                    </option>
                  ))}
                </select>
                <input
                  name="topics"
                  required
                  defaultValue={
                    content?.topics?.slice(1).join(", ") || "project, research"
                  }
                  placeholder="例如：AI, business"
                />
              </div>
            ) : (
              <input
                name="topics"
                required
                defaultValue={content?.topics?.join(", ") || "other"}
                placeholder="例如：AI, business"
              />
            )}
          </label>
          <label>
            排序
            <input
              type="number"
              name="sortOrder"
              min={-100000}
              max={100000}
              step={1}
              defaultValue={content?.sortOrder || 0}
            />
          </label>
          <label>
            附加本地资源（每行一个）
            <textarea
              name="assetsJson"
              rows={3}
              defaultValue={content?.assetsJson?.join("\n") || ""}
              placeholder="/media/projects/…/data.json"
            />
          </label>
          <label>
            正文 / 简介
            <textarea
              name="description"
              rows={6}
              maxLength={100000}
              defaultValue={content?.description}
            />
          </label>
          {type !== "folder" && (
            <label>
              封面地址
              <input
                name="coverUrl"
                defaultValue={content?.coverUrl || ""}
                placeholder="/media/… 或 https://…"
              />
            </label>
          )}
          {type === "video" && (
            <>
              <label>
                视频地址
                <input
                  name="fileUrl"
                  defaultValue={content?.fileUrl || ""}
                  placeholder="/media/… 或 https://…"
                />
              </label>
              <label>
                HLS 地址
                <input
                  name="hlsUrl"
                  defaultValue={content?.hlsUrl || ""}
                  placeholder="https://…/index.m3u8"
                />
              </label>
            </>
          )}
          {type === "pdf" && (
            <label>
              PDF 地址
              <input
                name="pdfUrl"
                required
                defaultValue={content?.pdfUrl || content?.fileUrl || ""}
                placeholder="/media/… 或 https://…"
              />
            </label>
          )}
          {(type === "ppt" || type === "longimage") && (
            <label>
              {type === "ppt"
                ? "幻灯片地址（每行一张）"
                : "长图地址（每行一张）"}
              <textarea
                name="imagesJson"
                rows={5}
                required
                defaultValue={content?.imagesJson?.join("\n") || ""}
                placeholder={
                  type === "ppt"
                    ? "/media/slide-1.png"
                    : "/media/long-image.png"
                }
              />
            </label>
          )}
          <ErrorMessage message={error} />
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={close}
          >
            取消
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "正在保存…" : "保存内容"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
