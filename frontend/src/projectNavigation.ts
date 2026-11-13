import { flatten, type Content } from "./types.js";
import { isWorldProject, worldIssues } from './worldModel.js';
import { isLivelihoodProject, livelihoodIssues } from './livelihoodModel.js';

export const castleProjectTitle = "日常生活 | 学 | 德智体美用";

export function isCastleProject(content: Content) {
  return (
    content.type === "folder" &&
    content.scene === "life" &&
    [castleProjectTitle, "爱的城堡"].includes(content.title)
  );
}

export function isProject(content: Content) {
  return content.isProject === true;
}

export function projectFolder(project: Content, id: number | null) {
  return (
    flatten(project.children || []).find(
      (item) => item.type === "folder" && item.id === id,
    ) || null
  );
}

export function folderNavigationPath(projects: Content[], folder: Content) {
  const owner = projects.find((project) => project.id === folder.id || projectFolder(project, folder.id));
  if (!owner) return `/home?folder=${folder.id}`;
  if (owner.id === folder.id) return `/home?project=${owner.id}`;
  if (isWorldProject(owner) && worldIssues(owner).some((issue) => issue.id === folder.id))
    return `/home?project=${owner.id}&issue=${folder.id}`;
  if (isLivelihoodProject(owner) && livelihoodIssues(owner).some((issue) => issue.id === folder.id))
    return `/home?project=${owner.id}&lifeView=issues&lifeIssue=${folder.id}&lifeSection=situation`;
  return `/home?project=${owner.id}&folder=${folder.id}`;
}

export function professionalModuleTarget(module: Content | undefined) {
  if (!module) return null;
  if (module.type !== "folder") return module;
  return module.children?.find((item) => item.type !== "folder") || module;
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
