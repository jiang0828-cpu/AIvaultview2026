export type PlanStatus = "planned" | "ongoing" | "completed" | "cancelled";
export type Day = { date: string; title: string; detail: string };
export type PlanInput = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  transport: string;
  companions: string;
  budget: number | null;
  actualSpent: number | null;
  itinerary: Day[];
  notes: string;
};
export type Plan = PlanInput & { id: number; updatedAt: string };
export type NoteSection = { title: string; body: string };
export type TimelineEntry = {
  time: string;
  title: string;
  text: string;
  preview: string;
  kind: "drive" | "meal" | "rest" | "visit" | "rain" | "note";
};

export const planStatuses: Record<PlanStatus, string> = {
  planned: "计划中",
  ongoing: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};
export const formatMoney = (cents: number | null) =>
  cents === null
    ? "未填写"
    : `¥${(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;

export function splitNoteSections(notes: string): NoteSection[] {
  const sections: NoteSection[] = [];
  let current: NoteSection = { title: "出行记录", body: "" };
  for (const line of notes.split(/\r?\n/)) {
    const heading = line.match(/^【([^】]+)】\s*$/);
    if (heading) {
      if (current.body.trim())
        sections.push({ ...current, body: current.body.trim() });
      current = { title: heading[1], body: "" };
    } else current.body += `${line}\n`;
  }
  if (current.body.trim())
    sections.push({ ...current, body: current.body.trim() });
  return sections;
}

export function timeline(detail: string): TimelineEntry[] {
  return detail
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const text = line.trim();
      const match = text.match(
        /^(\d{1,2}:\d{2}(?:[—–-]\d{1,2}:\d{2})?(?:前后|左右|前)?)\s*(.*)$/,
      );
      const body = match?.[2] || text;
      const title = body.split(/[，。；：]/)[0].trim() || body;
      const preview = body.split("。")[0];
      const kind = /雨天|有雨|停园/.test(title)
        ? "rain"
        : /早餐|午餐|晚餐|吃|用餐/.test(title)
          ? "meal"
          : /午休|休息|回酒店|入住|起床|退房|收拾/.test(title)
            ? "rest"
            : /出发|返南京|返宁|到服务区|导航/.test(title)
              ? "drive"
              : match
                ? "visit"
                : "note";
      return {
        time: match?.[1] || "提醒",
        title,
        text: body,
        preview: preview.length > 72 ? `${preview.slice(0, 72)}…` : preview,
        kind,
      };
    });
}

export function routeStops(destination: string): string[] {
  return destination
    .split(/\s*(?:→|->|➜)\s*/)
    .map((stop) => stop.replace(/（[^）]*）|\([^)]*\)/g, "").trim())
    .filter(Boolean);
}

export function budgetItems(
  section: NoteSection | undefined,
): { label: string; cents: number }[] {
  if (!section) return [];
  return section.body.split(/\r?\n/).flatMap((line) => {
    if (/^\s*(?:合计|总计|预算|实际|机动金含)/.test(line)) return [];
    const expression = line.split(/[（(]/)[0].trim();
    const match = expression.match(/^(.*?)(\d+(?:\.\d{1,2})?)\s*$/);
    if (!match || !match[1].trim()) return [];
    const label = expression.includes("=")
      ? expression.includes("住宿")
        ? "两晚住宿"
        : expression.includes("方特")
          ? "方特门票"
          : expression.slice(0, expression.indexOf("=")).replace(/\d+(?:\.\d+)?(?:\s*[+×*/-]\s*\d+(?:\.\d+)?)*\s*$/, "")
      : match[1];
    return [{ label: label.trim(), cents: Math.round(Number(match[2]) * 100) }];
  });
}

export function tripLength(start: string, end: string) {
  const days =
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86400000,
    ) + 1;
  return Number.isFinite(days) && days > 0 ? days : null;
}

export function dayLabel(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime())) return date;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(value);
}
