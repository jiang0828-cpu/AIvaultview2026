import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Car,
  Check,
  CheckCheck,
  CloudRain,
  Compass,
  MapPin,
  Pencil,
  Printer,
  Shirt,
  Ticket,
  Utensils,
  Wallet,
  Backpack,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  budgetItems,
  dayLabel,
  formatMoney,
  planStatuses,
  routeStops,
  splitNoteSections,
  timeline,
  tripLength,
  type NoteSection,
  type Plan,
  type TimelineEntry,
} from "./tripGuideModel";
import "./trip-guide.css";
import { ShareLinkButton } from "./ShareLinkButton";

const entryIcons = {
  drive: Car,
  meal: Utensils,
  rest: BedDouble,
  visit: MapPin,
  rain: CloudRain,
  note: Info,
};
function sectionIcon(title: string) {
  return /住宿/.test(title)
    ? BedDouble
    : /吃/.test(title)
      ? Utensils
      : /穿/.test(title)
        ? Shirt
        : /票务/.test(title)
          ? Ticket
          : /天气/.test(title)
            ? CloudRain
            : /路线/.test(title)
              ? Car
              : /基础/.test(title)
                ? Info
                : Compass;
}
function LinkedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ScheduleEntry({ entry }: { entry: TimelineEntry }) {
  const Icon = entryIcons[entry.kind];
  const extra = entry.preview.startsWith(entry.title)
    ? entry.preview.slice(entry.title.length).replace(/^[，。：；\s]+/, "")
    : entry.preview;
  return (
    <li className={`guide-event event-${entry.kind}`}>
      <span className="guide-event-icon">
        <Icon size={15} />
      </span>
      <div className="guide-event-content">
        <time>{entry.time}</time>
        <h4>{entry.title}</h4>
        {extra && <p>{extra}</p>}
        {entry.text !== entry.title && (
          <details>
            <summary>
              查看细节 <ChevronDown size={12} />
            </summary>
            <p>{entry.text}</p>
          </details>
        )}
      </div>
    </li>
  );
}

function PracticalSection({ section }: { section: NoteSection }) {
  const Icon = sectionIcon(section.title);
  return (
    <article className="guide-practical-item">
      <h3>
        <Icon size={19} />
        {section.title.split("：")[0]}
      </h3>
      {section.body
        .split(/\n+/)
        .filter(Boolean)
        .map((line, index) => {
          const first = line.split("。")[0];
          return (
            <div className="guide-practical-line" key={index}>
              <p>
                <LinkedText
                  text={first + (first.length < line.length ? "。" : "")}
                />
              </p>
              {first.length < line.length && (
                <details>
                  <summary>
                    展开说明 <ChevronDown size={12} />
                  </summary>
                  <p>
                    <LinkedText text={line.slice(first.length + 1)} />
                  </p>
                </details>
              )}
            </div>
          );
        })}
    </article>
  );
}

export function TripGuide({
  plan,
  onBack,
  onEdit,
  projectId,
  readOnly = false,
}: {
  plan: Plan;
  onBack: () => void;
  onEdit: () => void;
  projectId?: number;
  readOnly?: boolean;
}) {
  const sections = splitNoteSections(plan.notes);
  const budgetSection = sections.find((section) => /^预算/.test(section.title));
  const costs = budgetItems(budgetSection);
  const costTotal = costs.reduce((sum, item) => sum + item.cents, 0);
  const checklist = sections
    .filter((section) => /待办/.test(section.title))
    .flatMap((section) =>
      section.body
        .split("\n")
        .filter((line) => /^\[ \]/.test(line))
        .map((line) => line.replace(/^\[ \]\s*/, "")),
    );
  const [checked, setChecked] = useState<number[]>([]);
  const stops = routeStops(plan.destination);
  const winterLake = /洪泽|柳巷/.test(plan.destination) &&
    ["12", "01", "02"].includes(plan.startDate.slice(5, 7));
  const jinan = /济南/.test(plan.destination);
  const artwork = jinan
    ? "/images/jinan-roadtrip.webp"
    : winterLake
      ? "/images/winter-lake-roadtrip.webp"
      : "/images/family-roadtrip.webp";
  const duration = tripLength(plan.startDate, plan.endDate);
  const days = [...plan.itinerary].sort((a, b) => a.date.localeCompare(b.date));
  const practical = sections.filter(
    (section) => !/预算|待办|核验来源|回程后/.test(section.title),
  );
  const archive = sections.filter((section) =>
    /核验来源|回程后/.test(section.title),
  );
  return (
    <article className={`trip-guide${jinan ? " guide-jinan" : winterLake ? " guide-winter-lake" : ""}`} aria-labelledby="trip-guide-title">
      <div className="guide-toolbar">
        {!readOnly && <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> 我的安排
        </button>}
        <div>
          {!readOnly && projectId && <ShareLinkButton target={{ kind: "trip", projectId, tripId: plan.id }} />}
          {!readOnly && <button className="button" onClick={onEdit}>
            <Pencil size={15} /> 编辑
          </button>}
          <button className="button" onClick={() => window.print()}>
            <Printer size={15} /> 打印
          </button>
        </div>
      </div>
      <header className="guide-title">
        <p className="guide-eyebrow">
          <Compass size={15} /> 我的旅行手册{" "}
          <span>{planStatuses[plan.status]}</span>
        </p>
        <h1 id="trip-guide-title">{plan.title}</h1>
        <p className="guide-companions">{plan.companions || "我的出行"}</p>
        <dl className="guide-facts">
          <div>
            <dt>
              <CalendarDays size={16} /> 出发与返程
            </dt>
            <dd>
              {plan.startDate.slice(5).replace("-", ".")} —{" "}
              {plan.endDate.slice(5).replace("-", ".")}{" "}
              <small>{plan.startDate.slice(0, 4)}年</small>
            </dd>
          </div>
          <div>
            <dt>
              <Car size={16} /> 旅程节奏
            </dt>
            <dd>
              {duration
                ? `${duration}天${Math.max(0, duration - 1)}晚`
                : "按行程出发"}
              <small> · 自己的步调</small>
            </dd>
          </div>
          <div>
            <dt>
              <Wallet size={16} /> 全程计划预算
            </dt>
            <dd>
              {formatMoney(plan.budget)}
              <small> / 全部同行人</small>
            </dd>
          </div>
        </dl>
      </header>
      <figure className="guide-cover">
        <img
          src={artwork}
          width={2172}
          height={724}
          alt={jinan
            ? "冬日城市住宿、泉水园林与湖畔串联的一家三口济南自驾插画"
            : winterLake
              ? "冬日河畔村落、湖堤和博物馆串联的一家三口自驾插画"
              : "竹林湖畔、亲子乐园与城市博物馆串联的自驾旅程插画"}
        />
        <figcaption>旅程插画 · 非景区实拍</figcaption>
      </figure>
      {stops.length > 1 && (
        <section className="guide-route" aria-label="自驾路线示意">
          <div className="guide-section-label">
            <Car size={17} />
            <strong>这次怎么走</strong>
            <small>路线示意，实际按当天导航</small>
          </div>
          <ol>
            {stops.map((stop, index) => (
              <li key={index}>
                <span className="guide-route-number">{index + 1}</span>
                <strong>{stop}</strong>
                {index < stops.length - 1 && (
                  <ArrowRight size={17} className="guide-route-arrow" />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      <nav className="guide-jump-nav" aria-label="行程章节">
        <a href="#guide-days">
          <CalendarDays size={15} /> 每日安排
        </a>
        <a href="#guide-practical">
          <Backpack size={15} /> 衣食住行
        </a>
        <a href="#guide-budget">
          <Wallet size={15} /> 预算
        </a>
        <a href="#guide-checklist">
          <CheckCheck size={15} /> 行前清单
        </a>
      </nav>
      <section id="guide-days" className="guide-section">
        <div className="guide-section-heading">
          <div>
            <p className="guide-eyebrow">一路有安排，也给休息留位置</p>
            <h2>每天，只抓住最重要的事</h2>
          </div>
          <span>{days.length} 天行程</span>
        </div>
        {!days.length && (
          <p className="muted">还没填写每日行程，可在编辑中添加。</p>
        )}
        <div className="guide-days-grid">
          {days.map((day, index) => (
            <article
              className={`guide-day guide-day-${index % 3}`}
              key={`${day.date}-${index}`}
            >
              <div
                className="guide-day-art"
                style={{
                  backgroundPosition: `${[0, 50, 100][index % 3]}% center`,
                }}
                aria-hidden="true"
              >
                <span>DAY {String(index + 1).padStart(2, "0")}</span>
              </div>
              <header>
                <time>{dayLabel(day.date)}</time>
                <h3>{day.title.replace(/^D\d+\s*[^｜]*｜\s*/, "")}</h3>
              </header>
              <ol className="guide-timeline">
                {timeline(day.detail).map((entry, i) => (
                  <ScheduleEntry key={i} entry={entry} />
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
      <section id="guide-practical" className="guide-section">
        <div className="guide-section-heading">
          <div>
            <p className="guide-eyebrow">带着孩子，少一点临场忙乱</p>
            <h2>衣食住行，提前心里有数</h2>
          </div>
          <Backpack size={24} />
        </div>
        <div className="guide-practical-grid">
          {practical.map((section, index) => (
            <PracticalSection key={index} section={section} />
          ))}
        </div>
        {!practical.length && (
          <p className="muted">暂未记录住宿、餐饮或其他出行说明。</p>
        )}
      </section>
      <section id="guide-budget" className="guide-section guide-budget">
        <div className="guide-section-heading">
          <div>
            <p className="guide-eyebrow">把钱花在哪里，一眼看清</p>
            <h2>这趟预留 {formatMoney(plan.budget)}</h2>
          </div>
          <span>计划预算 · 非已支付</span>
        </div>
        <div className="guide-costs">
          {costs.map((item, index) => (
            <div className={`guide-cost cost-${index % 5}`} key={index}>
              <span>{item.label}</span>
              <div className="guide-cost-track">
                <i
                  style={{
                    width: `${Math.min(100, (item.cents / Math.max(costTotal, 1)) * 100)}%`,
                  }}
                />
              </div>
              <strong>{formatMoney(item.cents)}</strong>
            </div>
          ))}
        </div>
        {costs.length > 0 && (
          <p className="guide-budget-total">
            分项合计 <strong>{formatMoney(costTotal)}</strong>
            {costTotal !== plan.budget && (
              <span> · 与计划总预算不同，请核对分项</span>
            )}
          </p>
        )}
        {!costs.length && <p className="muted">尚无可展示的费用分项。</p>}
        {budgetSection && (
          <details className="guide-raw-budget">
            <summary>
              费用依据与浮动说明 <ChevronDown size={14} />
            </summary>
            <p>
              <LinkedText text={budgetSection.body} />
            </p>
          </details>
        )}
      </section>
      <section id="guide-checklist" className="guide-section">
        <div className="guide-section-heading">
          <div>
            <p className="guide-eyebrow">准备妥当，再安心出发</p>
            <h2>出发前，一项项确认</h2>
          </div>
          <span>
            {checked.length} / {checklist.length} 项
          </span>
        </div>
        <div className="guide-checklist">
          {checklist.map((item, index) => (
            <label
              className={checked.includes(index) ? "checked" : ""}
              key={index}
            >
              <input
                type="checkbox"
                checked={checked.includes(index)}
                onChange={(event) =>
                  setChecked((current) =>
                    event.target.checked
                      ? [...current, index]
                      : current.filter((value) => value !== index),
                  )
                }
              />
              <span>
                <Check size={14} aria-hidden="true" />
              </span>
              <p>{item}</p>
            </label>
          ))}
        </div>
        {!checklist.length && <p className="muted">暂未记录行前待办。</p>}
      </section>
      {archive.map((section, index) => (
        <details className="guide-archive" key={index}>
          <summary>
            {section.title}
            <ChevronDown size={15} />
          </summary>
          <p>
            <LinkedText text={section.body} />
          </p>
        </details>
      ))}
      {plan.notes && (
        <details className="guide-archive guide-original">
          <summary>
            完整原始备注
            <ChevronDown size={15} />
          </summary>
          <p>
            <LinkedText text={plan.notes} />
          </p>
        </details>
      )}
      <footer className="guide-footer">
        <span>观澜 · 我的旅行手册</span>
        <span>按自己的节奏，好好走这一程。</span>
      </footer>
    </article>
  );
}
