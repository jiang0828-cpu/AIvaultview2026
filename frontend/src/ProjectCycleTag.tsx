import { useState } from "react";
import { api } from "./api";
import { projectCycles, type Content } from "./types";
import { Flag, Hourglass, Infinity as InfinityIcon, LoaderCircle } from "lucide-react";

export function ProjectCycleTag({ project, editable, onSaved }: {
  project: Content;
  editable: boolean;
  onSaved: (project: Content) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cycle = project.topics?.[0] || "阶段性";
  const CycleIcon = cycle === "长期性" ? InfinityIcon : cycle === "临时性" ? Hourglass : Flag;
  async function change(value: string) {
    setBusy(true);
    setError("");
    try {
      const updated = await api<Content>(`/contents/${project.id}/cycle`, {
        method: "PATCH",
        body: JSON.stringify({ cycle: value }),
      });
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "周期保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="project-cycle-control" data-cycle={cycle} aria-busy={busy}>
      {editable ? (
        <label className="project-cycle-field">
          <CycleIcon size={12} aria-hidden="true" />
          <span>周期</span>
          <select
            aria-label={`${project.title}项目周期`}
            value={cycle}
            disabled={busy}
            onChange={(event) => { void change(event.target.value); }}
          >
            {projectCycles.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      ) : <span className="topic-pill project-cycle-pill"><CycleIcon size={12} aria-hidden="true" /><span>周期 · {cycle}</span></span>}
      {busy && <span className="cycle-save-status" role="status"><LoaderCircle size={12} className="status-spinner" aria-hidden="true" />保存中…</span>}
      {error && <span className="project-cycle-error" role="alert">{error}</span>}
    </span>
  );
}
