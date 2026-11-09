import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import { loadOrgMemberProfiles, type MemberProfile } from "../lib/members";
import type { PlanningEvent } from "../types";

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function Planning() {
  const { orgId } = useOrg();
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [attendees, setAttendees] = useState<Set<string>>(new Set());

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: evs, error }, { data: atts }, profs] = await Promise.all([
      supabase.from("events").select("*").eq("organization_id", orgId)
        .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()).order("starts_at"),
      supabase.from("event_attendees").select("event_id, user_id"),
      loadOrgMemberProfiles(orgId),
    ]);
    if (error) return setMsg(error.message);
    setMembers(profs);
    const byId = new Map(profs.map((p) => [p.user_id, p.display_name]));
    const attByEvent = new Map<string, { user_id: string; display_name: string }[]>();
    for (const a of atts ?? []) {
      const list = attByEvent.get(a.event_id) ?? [];
      list.push({ user_id: a.user_id, display_name: byId.get(a.user_id) || "Membre" });
      attByEvent.set(a.event_id, list);
    }
    setEvents((evs ?? []).map((e) => ({ ...e, attendees: attByEvent.get(e.id) ?? [] })) as PlanningEvent[]);
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  function toggleAttendee(id: string) {
    setAttendees((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!title.trim() || !start) return setMsg("Titre et date de début obligatoires.");
    const { data: ev, error } = await supabase.from("events").insert({
      organization_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      starts_at: new Date(start).toISOString(),
      ends_at: end ? new Date(end).toISOString() : null,
    }).select("id").single();
    if (error || !ev) return setMsg(error?.message ?? "Erreur.");
    const toAdd = userId ? new Set(attendees).add(userId) : attendees;
    if (toAdd.size) {
      const { error: e2 } = await supabase.from("event_attendees").insert(
        Array.from(toAdd).map((user_id) => ({ event_id: ev.id, user_id })),
      );
      if (e2) setMsg(e2.message);
    }
    setTitle(""); setDescription(""); setStart(""); setEnd(""); setAttendees(new Set());
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cet événement ?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) setMsg(error.message);
    else await load();
  }

  const byDay = new Map<string, PlanningEvent[]>();
  for (const ev of events) {
    const key = new Date(ev.starts_at).toDateString();
    const list = byDay.get(key) ?? [];
    list.push(ev);
    byDay.set(key, list);
  }

  return (
    <>
      <h1>Planning</h1>
      <div className="card">
        <h2>Nouvel événement</h2>
        <form onSubmit={add}>
          <div className="row">
            <label>Titre<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>Début<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
            <label>Fin (optionnel)<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <label>Description
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>Inviter des membres
            <div className="row" style={{ gap: ".5rem" }}>
              {members.filter((m) => m.user_id !== userId).map((m) => (
                <button
                  key={m.user_id} type="button"
                  className={attendees.has(m.user_id) ? "" : "secondary"}
                  onClick={() => toggleAttendee(m.user_id)}
                >
                  {m.display_name}
                </button>
              ))}
              {members.length <= 1 && <span className="hint">Aucun autre membre dans cette organisation.</span>}
            </div>
          </label>
          <button type="submit">Ajouter au planning</button>
        </form>
        {msg && <p className="msg">{msg}</p>}
      </div>

      {Array.from(byDay.entries()).map(([day, evs]) => (
        <div className="card" key={day}>
          <h2 style={{ textTransform: "capitalize" }}>{fmtDay(evs[0].starts_at)}</h2>
          {evs.map((ev) => (
            <div className="member-row" key={ev.id}>
              <div className="who" style={{ flexDirection: "column", alignItems: "flex-start", gap: ".2rem" }}>
                <span className="name">{fmtTime(ev.starts_at)}{ev.ends_at ? ` – ${fmtTime(ev.ends_at)}` : ""} · {ev.title}</span>
                {ev.description && <span className="email">{ev.description}</span>}
                {ev.attendees.length > 0 && (
                  <span className="email">Avec {ev.attendees.map((a) => a.display_name).join(", ")}</span>
                )}
              </div>
              {(ev.created_by === userId) && (
                <button className="danger" onClick={() => remove(ev.id)}>Supprimer</button>
              )}
            </div>
          ))}
        </div>
      ))}
      {events.length === 0 && <p className="hint">Aucun événement à venir.</p>}
    </>
  );
}
