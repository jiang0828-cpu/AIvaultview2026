import { flatten, scenes, type Content, type SceneKey } from "./types.js";

export const projectSortOptions = [
  { value: "updatedAt", label: "更新时间" },
  { value: "createdAt", label: "创建时间" },
  { value: "title", label: "项目名称" },
  { value: "scene", label: "项目类型" },
] as const;

export const projectFilterKeys = ["q", "scene", "sort", "order", "createdFrom", "createdTo", "updatedFrom", "updatedTo"] as const;
export type ProjectSortKey = typeof projectSortOptions[number]["value"];
export type ProjectFilters = {
  q: string;
  scene: SceneKey | "";
  sort: ProjectSortKey;
  order: "asc" | "desc";
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function projectDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = dateFormatter.formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return projectDateKey(`${value}T00:00:00+08:00`) === value ? value : "";
}

export function readProjectFilters(params: URLSearchParams): ProjectFilters {
  return {
    q: params.get("q") || "",
    scene: scenes.find((scene) => scene.key === params.get("scene"))?.key || "",
    sort: projectSortOptions.find((sort) => sort.value === params.get("sort"))?.value || "updatedAt",
    order: params.get("order") === "asc" ? "asc" : "desc",
    createdFrom: validDate(params.get("createdFrom")),
    createdTo: validDate(params.get("createdTo")),
    updatedFrom: validDate(params.get("updatedFrom")),
    updatedTo: validDate(params.get("updatedTo")),
  };
}

export function projectFilterError(filters: ProjectFilters): string {
  if (filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo)
    return "创建时间的开始日期不能晚于结束日期";
  if (filters.updatedFrom && filters.updatedTo && filters.updatedFrom > filters.updatedTo)
    return "更新时间的开始日期不能晚于结束日期";
  return "";
}

export function getProjectMetadata(project: Content) {
  const contents = flatten(project.children || []);
  const updatedAt = contents.reduce((latest, content) => {
    const nextTime = Date.parse(content.updatedAt);
    return Number.isFinite(nextTime) && (!Number.isFinite(Date.parse(latest)) || nextTime > Date.parse(latest))
      ? content.updatedAt : latest;
  }, project.updatedAt);
  const hasRootTopics = Boolean(project.topics?.length);
  const topics = [...new Set(hasRootTopics
    ? project.topics!
    : contents.flatMap((content) => content.topics || []))].slice(0, hasRootTopics ? 3 : 2);
  return { updatedAt, topics };
}

export function filterProjects(projects: Content[], filters: ProjectFilters): Content[] {
  if (projectFilterError(filters)) return [];
  const keywords = filters.q.toLocaleLowerCase("zh-CN").trim().split(/\s+/).filter(Boolean);
  const inRange = (value: string, from: string, to: string) =>
    (!from && !to) || Boolean(value && (!from || value >= from) && (!to || value <= to));

  const rows = projects.map((project) => {
    const metadata = getProjectMetadata(project);
    return {
      project,
      ...metadata,
      title: project.title.replace(/^项目\d+｜/, ""),
      sceneLabel: scenes.find((scene) => scene.key === project.scene)?.label || project.scene,
      createdDate: projectDateKey(project.createdAt),
      updatedDate: projectDateKey(metadata.updatedAt),
    };
  }).filter((row) => {
    const searchable = [row.project.title, row.sceneLabel, ...row.topics, row.createdDate, row.updatedDate,
      row.createdDate.replaceAll("-", "/"), row.updatedDate.replaceAll("-", "/")].join(" ").toLocaleLowerCase("zh-CN");
    return (!filters.scene || row.project.scene === filters.scene)
      && keywords.every((keyword) => searchable.includes(keyword))
      && inRange(row.createdDate, filters.createdFrom, filters.createdTo)
      && inRange(row.updatedDate, filters.updatedFrom, filters.updatedTo);
  });

  const direction = filters.order === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    let comparison: number;
    if (filters.sort === "title") comparison = collator.compare(a.title, b.title);
    else if (filters.sort === "scene") comparison = collator.compare(a.sceneLabel, b.sceneLabel);
    else {
      const first = Date.parse(filters.sort === "createdAt" ? a.project.createdAt : a.updatedAt);
      const second = Date.parse(filters.sort === "createdAt" ? b.project.createdAt : b.updatedAt);
      // Missing dates stay last in either direction.
      if (!Number.isFinite(first) || !Number.isFinite(second)) {
        if (Number.isFinite(first)) return -1;
        if (Number.isFinite(second)) return 1;
        comparison = 0;
      } else comparison = first - second;
    }
    return comparison * direction || collator.compare(a.title, b.title) || a.project.id - b.project.id;
  }).map((row) => row.project);
}
