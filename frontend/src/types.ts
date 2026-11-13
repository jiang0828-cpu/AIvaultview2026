export type Role = "visitor" | "share" | "admin";
export interface SessionUser {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}
export type ContentType =
  "folder" | "video" | "ppt" | "mindmap" | "longimage" | "pdf" | "text";
export type SceneKey =
  "system" | "tools" | "life" | "work" | "hobbies" | "other";
export const scenes: Array<{ key: SceneKey; label: string }> = [
  { key: "system", label: "系统管理" },
  { key: "tools", label: "工具方法" },
  { key: "life", label: "生活场景" },
  { key: "work", label: "事业工作" },
  { key: "hobbies", label: "兴趣爱好" },
  { key: "other", label: "其他模块" },
];
export const projectCycles = ["长期性", "阶段性", "临时性"] as const;
export interface Content {
  id: number;
  title: string;
  type: ContentType;
  isProject?: boolean;
  navigationOnly?: boolean;
  scene: SceneKey;
  topics: string[] | null;
  description: string;
  coverUrl: string | null;
  fileUrl: string | null;
  hlsUrl: string | null;
  pdfUrl: string | null;
  imagesJson: string[] | null;
  assetsJson?: string[] | null;
  sortOrder: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  children?: Content[];
}
export const typeNames: Record<ContentType, string> = {
  folder: "目录",
  video: "视频",
  ppt: "幻灯片",
  mindmap: "思维导图",
  longimage: "长图",
  pdf: "PDF 文档",
  text: "文章",
};
export function flatten(items: Content[]): Content[] {
  return items.flatMap((item) => [item, ...flatten(item.children || [])]);
}
