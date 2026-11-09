import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import { loadOrgMemberProfiles, type MemberProfile } from "../lib/members";
import type { Task, TaskStatus } from "../types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "À faire" },
  { status: "in_progress", label: "En cours" },
  { status: "done", label: "Terminé" },
];

export default function Tasks() {
  const { orgId, role } = useOrg();
  const canAssignOthers = role === "owner" || role === "admin";

  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: ts, error }, profs] = await Promise.all([
      supabase.from("tasks").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      loadOrgMemberProfiles(orgId),
    ]);
    if (error) return setMsg(error.message);
    setMembers(profs);
    const byId = new Map(profs.map((p) => [p.user_id, p]));
    setTasks((ts ?? []).map((t) => ({
      ...t,
      assignee: t.assigned_to ? { display_name: byId.get(t.assigned_to)?.display_name || "Membre" } : null,
      assigner: { display_name: byId.get(t.assigned_by)?.display_name || "Membre" },
    })) as Task[]);
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (userId && !canAssignOthers) setAssignedTo(userId); }, [userId, canAssignOthers]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!title.trim()) return setMsg("Donnez un titre à la tâche.");
    const { error } = await supabase.from("tasks").insert({
      organization_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo || userId,
      due_date: dueDate || null,
    });
    if (error) return setMsg(error.message);
    setTitle(""); setDescription(""); setDueDate("");
    if (canAssignOthers) setAssignedTo("");
    await load();
  }

  async function setStatus(t: Task, status: TaskStatus) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) setMsg(error.message);
    else await load();
  }

  async function remove(t: Task) {
    if (!window.confirm(`Supprimer la tâche « ${t.title} » ?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) setMsg(error.message);
    else await load();
  }

  return (
    <>
      <h1>Tâches</h1>
      <div className="card">
        <h2>{canAssignOthers ? "Créer / assigner une tâche" : "Ajouter une tâche"}</h2>
        <form onSubmit={add}>
          <div className="row">
            <label>Titre<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>Échéance<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          </div>
          {canAssignOthers && (
            <label>Assigner à
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Moi-même</option>
                {members.filter((m) => m.user_id !== userId).map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </label>
          )}
          <label>Description
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button type="submit">Ajouter</button>
        </form>
        {msg && <p className="msg">{msg}</p>}
      </div>

      <div className="task-board">
        {COLUMNS.map((col) => (
          <div className="task-col" key={col.status}>
            <h2>{col.label} ({tasks.filter((t) => t.status === col.status).length})</h2>
            {tasks.filter((t) => t.status === col.status).map((t) => (
              <div className="task-card" key={t.id}>
                <div className="title">{t.title}</div>
                {t.description && <div className="hint" style={{ margin: 0 }}>{t.description}</div>}
                <div className="meta">
                  <span>
                    {t.assignee?.display_name}
                    {t.assigned_by !== t.assigned_to ? ` · assignée par ${t.assigner?.display_name}` : ""}
                  </span>
                  {t.due_date && <span>{t.due_date}</span>}
                </div>
                <div className="actions">
                  {COLUMNS.filter((c) => c.status !== t.status).map((c) => (
                    <button key={c.status} className="secondary" onClick={() => setStatus(t, c.status)}>{c.label}</button>
                  ))}
                  <button className="danger" onClick={() => remove(t)}>×</button>
                </div>
              </div>
            ))}
            {tasks.filter((t) => t.status === col.status).length === 0 && <p className="hint">Aucune tâche.</p>}
          </div>
        ))}
      </div>
    </>
  );
}
