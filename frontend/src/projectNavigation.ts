import { flatten, type Content } from "./types.js";

export function isCastleProject(content: Content) {
  return (
    content.type === "folder" &&
    content.scene === "life" &&
    content.title === "爱的城堡"
  );
}

export function isProject(content: Content) {
  return (
    content.type === "folder" &&
    (content.title.startsWith("项目") || isCastleProject(content))
  );
}

export function projectFolder(project: Content, id: number | null) {
  return (
    flatten(project.children || []).find(
      (item) => item.type === "folder" && item.id === id,
    ) || null
  );
}

export function projectStats(content: Content) {
  const descendants = flatten(content.children || []);
  const documents = descendants.filter((item) => item.type !== "folder");
  return {
    folders: descendants.length - documents.length,
    documents: documents.length,
    formats: new Set(documents.map((item) => item.type)).size,
  };
}
