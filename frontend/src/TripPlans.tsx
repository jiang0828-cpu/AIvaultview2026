import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  MapPin,
  Plus,
  Pencil,
  Save,
  Trash2,
  X,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { api } from "./api";
import { flatten, type Content } from "./types";
import "./trip-plans.css";
import { TripGuide } from "./TripGuide";
import {
  planStatuses as statuses,
  formatMoney as money,
  type Day,
  type Plan,
  type PlanInput,
  type PlanStatus,
} from "./tripGuideModel";
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const blank = (): PlanInput => ({
  title: "",
  destination: "",
  startDate: today(),
  endDate: today(),
  status: "planned",
  transport: "",
  companions: "",
  budget: null,
  actualSpent: null,
  itinerary: [],
  notes: "",
});
const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : "请求失败，请稍后重试";

export function isTravelProject(project: Content | null | undefined) {
  return Boolean(
    project?.isProject &&
      (project.title.includes("南京周边游") ||
        project.description.includes("<!-- TRAVEL_PROJECT -->") ||
        flatten(project.children || []).some((content) =>
          /<!-- TRAVEL_(GUIDE_DASHBOARD|CITY_ATLAS) -->/.test(
            content.description,
          ),
        )),
  );
}

export function TripPlans({ projectId }: { projectId: number }) {
  const [params, setParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api<Plan[]>(`/trip-plans?projectId=${projectId}`)
      .then((rows) => {
        if (active) setPlans(rows);
      })
      .catch((err) => {
        if (active) setError(messageOf(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, retry]);
  const sorted = plans
    .filter((plan) => filter === "all" || plan.status === filter)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id);
  const activePlan = plans.find(
    (plan) => plan.id === Number(params.get("trip")),
  );
  const showGuide = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("trip");
    else next.set("trip", String(id));
    setParams(next);
    window.scrollTo({ top: 0 });
  };
  const remove = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await api(`/trip-plans/${id}`, { method: "DELETE", body: "{}" });
      setPlans((current) => current.filter((plan) => plan.id !== id));
      setDeleting(null);
      setNotice("安排已删除");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="trip-plans"
      aria-labelledby={activePlan ? "trip-guide-title" : "trip-plans-title"}
    >
      {activePlan ? (
        <TripGuide
          key={activePlan.id}
          plan={activePlan}
          onBack={() => showGuide(null)}
          onEdit={() => setEditing(activePlan)}
          projectId={projectId}
        />
      ) : (
        <>
          <header className="trip-plans-heading">
            <div>
              <p className="eyebrow">行者手记 · 每一程都有迹可循</p>
              <h1 id="trip-plans-title">
                <CalendarDays size={25} /> 我的安排
              </h1>
              <p className="muted">
                我的出行计划、行程与旅后记录 · 仅当前账号可见
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setEditing("new");
                setNotice("");
              }}
            >
              <Plus size={17} /> 新增安排
            </button>
          </header>
          <div className="trip-plan-summary">
            <span>
              <strong>{plans.length}</strong> 次出行
            </span>
            <span>
              <strong>
                {
                  plans.filter(
                    (plan) =>
                      plan.status === "planned" || plan.status === "ongoing",
                  ).length
                }
              </strong>{" "}
              待赴之约
            </span>
            <span>
              <strong>
                {plans.filter((plan) => plan.status === "completed").length}
              </strong>{" "}
              已完成
            </span>
          </div>
          <div className="trip-plan-toolbar">
            <label>
              行程状态{" "}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">全部安排</option>
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">按出发日期排序，共 {sorted.length} 条</span>
          </div>
          {notice && (
            <p className="trip-plan-notice" role="status">
              <Check size={15} /> {notice}
            </p>
          )}
          {params.has("trip") && !loading && !activePlan && !error && (
            <p className="trip-plan-error" role="alert">
              这条安排不存在或不属于当前账号。
              <button className="button" onClick={() => showGuide(null)}>
                返回我的安排
              </button>
            </p>
          )}
          {error && (
            <div className="trip-plan-error" role="alert">
              {error}{" "}
              <button
                className="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                重试
              </button>
            </div>
          )}
          {loading ? (
            <p className="empty" role="status">
              正在加载安排…
            </p>
          ) : !error && !sorted.length ? (
            <div className="trip-plans-empty">
              <CalendarDays size={34} />
              <h2>
                {plans.length ? "此状态下暂无安排" : "下一程，想去哪里？"}
              </h2>
              <p>
                {plans.length
                  ? "切换状态查看其他出行记录。"
                  : "从一个目的地开始，记下沿途的计划与见闻。"}
              </p>
              <button
                className="button primary"
                onClick={() => setEditing("new")}
              >
                <Plus size={16} /> 记录一次出行
              </button>
            </div>
          ) : (
            <div className="trip-plan-list">
              {sorted.map((plan) => (
                <article className="trip-plan-card" key={plan.id}>
                  <div className="trip-plan-card-top">
                    <div>
                      <span className={`trip-plan-status ${plan.status}`}>
                        {statuses[plan.status]}
                      </span>
                      <h2>{plan.title}</h2>
                      <p>
                        <MapPin size={15} /> {plan.destination}
                      </p>
                    </div>
                    <div className="trip-plan-card-actions">
                      <button
                        className="icon-button"
                        title="编辑安排"
                        aria-label={`编辑${plan.title}`}
                        onClick={() => {
                          setEditing(plan);
                          setNotice("");
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        title="删除安排"
                        aria-label={`删除${plan.title}`}
                        onClick={() => setDeleting(plan.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="trip-plan-dates">
                    <CalendarDays size={15} />
                    <time>{plan.startDate}</time>
                    <span>至</span>
                    <time>{plan.endDate}</time>
                  </div>
                  <dl className="trip-plan-facts">
                    <div>
                      <dt>交通</dt>
                      <dd>{plan.transport || "待安排"}</dd>
                    </div>
                    <div>
                      <dt>同行</dt>
                      <dd>{plan.companions || "未记录"}</dd>
                    </div>
                    <div>
                      <dt>预算</dt>
                      <dd>{money(plan.budget)}</dd>
                    </div>
                    <div>
                      <dt>实际花费</dt>
                      <dd>{money(plan.actualSpent)}</dd>
                    </div>
                  </dl>
                  <button
                    className="trip-plan-guide-link"
                    onClick={() => showGuide(plan.id)}
                  >
                    <BookOpen size={17} /> 查看图文行程 <ArrowRight size={16} />
                  </button>
                  <details className="trip-plan-record">
                    <summary>
                      行程与记录 <span>{plan.itinerary.length} 项行程</span>
                    </summary>
                    {!plan.itinerary.length && !plan.notes && (
                      <p className="muted">还未填写详细行程与记录。</p>
                    )}
                    <ol className="trip-plan-days">
                      {plan.itinerary.map((day, index) => (
                        <li key={index}>
                          <time>{day.date}</time>
                          <strong>{day.title}</strong>
                          <p>{day.detail}</p>
                        </li>
                      ))}
                    </ol>
                    {plan.notes && (
                      <div className="trip-plan-notes">
                        <h3>出行记录与备注</h3>
                        <p>{plan.notes}</p>
                      </div>
                    )}
                  </details>
                  {deleting === plan.id && (
                    <div className="trip-plan-delete" role="alert">
                      <span>删除后无法恢复，确认删除这次安排？</span>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => setDeleting(null)}
                      >
                        取消
                      </button>
                      <button
                        className="button danger"
                        disabled={busy}
                        onClick={() => void remove(plan.id)}
                      >
                        确认删除
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {editing && (
        <PlanEditor
          key={editing === "new" ? "new" : editing.id}
          projectId={projectId}
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            setPlans((current) => [
              ...current.filter((plan) => plan.id !== saved.id),
              saved,
            ]);
            setEditing(null);
            setNotice("安排已保存");
          }}
        />
      )}
    </section>
  );
}

function PlanEditor({
  projectId,
  plan,
  onClose,
  onSave,
}: {
  projectId: number;
  plan: Plan | null;
  onClose: () => void;
  onSave: (plan: Plan) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<PlanInput>(() =>
    plan
      ? {
          title: plan.title,
          destination: plan.destination,
          startDate: plan.startDate,
          endDate: plan.endDate,
          status: plan.status,
          transport: plan.transport,
          companions: plan.companions,
          budget: plan.budget,
          actualSpent: plan.actualSpent,
          itinerary: plan.itinerary.map((day) => ({ ...day })),
          notes: plan.notes,
        }
      : blank(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const change = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const close = () => {
    if (!dirty || window.confirm("还有未保存的安排，确定放弃修改吗？"))
      onClose();
  };
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const handle = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [dirty]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (draft.endDate < draft.startDate) {
      setError("结束日期不能早于开始日期");
      return;
    }
    if (
      draft.itinerary.some(
        (day) => day.date < draft.startDate || day.date > draft.endDate,
      )
    ) {
      setError("每日行程的日期必须在出行日期内");
      return;
    }
    setBusy(true);
    try {
      const saved = await api<Plan>(
        plan ? `/trip-plans/${plan.id}` : "/trip-plans",
        {
          method: plan ? "PUT" : "POST",
          body: JSON.stringify(plan ? draft : { ...draft, projectId }),
        },
      );
      onSave(saved);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  const updateDay = (index: number, key: keyof Day, value: string) =>
    change(
      "itinerary",
      draft.itinerary.map((day, i) =>
        i === index ? { ...day, [key]: value } : day,
      ),
    );
  return (
    <div className="trip-plan-overlay">
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) close();
        }}
        aria-labelledby="trip-plan-editor-title"
        className="trip-plan-editor"
      >
        <form onSubmit={submit}>
          <div className="trip-plan-editor-head">
            <h2 id="trip-plan-editor-title">
              {plan ? "编辑出行安排" : "新增出行安排"}
            </h2>
            <button
              type="button"
              autoFocus
              className="icon-button"
              disabled={busy}
              title="关闭编辑"
              aria-label="关闭编辑"
              onClick={close}
            >
              <X size={19} />
            </button>
          </div>
          <fieldset disabled={busy}>
            <div className="trip-plan-form-grid">
              <label>
                安排名称
                <input
                  required
                  value={draft.title}
                  onChange={(e) => change("title", e.target.value)}
                  placeholder="例如：秋日扬州两日行"
                  maxLength={120}
                />
              </label>
              <label>
                目的地
                <input
                  required
                  value={draft.destination}
                  onChange={(e) => change("destination", e.target.value)}
                  placeholder="城市、景点或沿途目的地"
                  maxLength={200}
                />
              </label>
              <label>
                出发日期
                <input
                  required
                  type="date"
                  min="0001-01-01"
                  max="9999-12-31"
                  value={draft.startDate}
                  onChange={(e) => change("startDate", e.target.value)}
                />
              </label>
              <label>
                结束日期
                <input
                  required
                  type="date"
                  min={draft.startDate || "0001-01-01"}
                  max="9999-12-31"
                  value={draft.endDate}
                  onChange={(e) => change("endDate", e.target.value)}
                />
              </label>
              <label>
                状态
                <select
                  value={draft.status}
                  onChange={(e) =>
                    change("status", e.target.value as PlanStatus)
                  }
                >
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                交通方式
                <input
                  value={draft.transport}
                  onChange={(e) => change("transport", e.target.value)}
                  placeholder="车次、自驾路线、接驳等"
                  maxLength={200}
                />
              </label>
              <label>
                同行人
                <input
                  value={draft.companions}
                  onChange={(e) => change("companions", e.target.value)}
                  placeholder="独行 / 家人 / 朋友"
                  maxLength={200}
                />
              </label>
              {(["budget", "actualSpent"] as const).map((key) => (
                <label key={key}>
                  {key === "budget" ? "计划预算" : "实际花费"}（元）
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    value={draft[key] === null ? "" : draft[key] / 100}
                    onChange={(e) =>
                      change(
                        key,
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 100),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="trip-plan-day-heading">
              <h3>每日行程</h3>
              <button
                type="button"
                className="button"
                disabled={draft.itinerary.length >= 90}
                onClick={() =>
                  change("itinerary", [
                    ...draft.itinerary,
                    { date: draft.startDate, title: "", detail: "" },
                  ])
                }
              >
                <Plus size={15} /> 添加行程
              </button>
            </div>
            <div className="trip-plan-day-editors">
              {draft.itinerary.map((day, index) => (
                <div className="trip-plan-day-editor" key={index}>
                  <label>
                    行程日期
                    <input
                      required
                      type="date"
                      min={draft.startDate}
                      max={draft.endDate}
                      value={day.date}
                      onChange={(e) => updateDay(index, "date", e.target.value)}
                    />
                  </label>
                  <label>
                    行程标题
                    <input
                      required
                      maxLength={120}
                      placeholder="景点、活动或住宿"
                      value={day.title}
                      onChange={(e) =>
                        updateDay(index, "title", e.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    title="移除行程"
                    aria-label={`移除第${index + 1}项行程`}
                    onClick={() =>
                      change(
                        "itinerary",
                        draft.itinerary.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                  <label className="trip-plan-wide">
                    具体安排
                    <textarea
                      rows={2}
                      maxLength={2000}
                      placeholder="游玩顺序、预约信息、用餐与时间安排"
                      value={day.detail}
                      onChange={(e) =>
                        updateDay(index, "detail", e.target.value)
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <label className="trip-plan-wide">
              出行内容与旅后记录
              <textarea
                rows={5}
                maxLength={10000}
                value={draft.notes}
                onChange={(e) => change("notes", e.target.value)}
                placeholder="住宿、待办清单、旅途见闻、实际体验和下次建议…"
              />
            </label>
          </fieldset>
          {error && (
            <p className="trip-plan-error" role="alert">
              {error}
            </p>
          )}
          <footer className="trip-plan-editor-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={close}
            >
              取消
            </button>
            <button className="button primary" disabled={busy}>
              <Save size={16} /> {busy ? "保存中…" : "保存安排"}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
