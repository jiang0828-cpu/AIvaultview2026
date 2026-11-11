export const projectCycles = ["长期性", "阶段性", "临时性"] as const;

export function hasProjectCycle(topics: unknown): topics is string[] {
  return Array.isArray(topics) && topics.length === 3 &&
    projectCycles.includes(topics[0] as (typeof projectCycles)[number]);
}
