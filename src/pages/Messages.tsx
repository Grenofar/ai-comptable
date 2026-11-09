import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import { loadOrgMemberProfiles, type MemberProfile } from "../lib/members";
import Avatar from "../components/Avatar";
import type { Conversation, Message } from "../types";

interface ConvItem { id: string; kind: "group" | "dm"; label: string; avatarUrl?: string | null }

export default function Messages() {
  const { orgId } = useOrg();
  const [userId, setUserId] = useState<string | null>(null);
  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesById, setProfilesById] = useState<Map<string, MemberProfile>>(new Map());
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const loadConvs = useCallback(async () => {
    if (!orgId || !userId) return;
    const { data, error } = await supabase
      .from("conversation_participants")
      .select("conversation_id, conversations!inner(id, organization_id, kind, name, created_at)")
      .eq("user_id", userId)
      .eq("conversations.organization_id", orgId);
    if (error) return setMsg(error.message);
    const rows = (data ?? []) as unknown as { conversation_id: string; conversations: Conversation }[];

    const dmIds = rows.filter((r) => r.conversations.kind === "dm").map((r) => r.conversation_id);
    let otherByConv = new Map<string, string>();
    if (dmIds.length) {
      const { data: parts } = await supabase.from("conversation_participants").select("conversation_id, user_id")
        .in("conversation_id", dmIds).neq("user_id", userId);
      otherByConv = new Map((parts ?? []).map((p) => [p.conversation_id as string, p.user_id as string]));
    }
    const profs = await loadOrgMemberProfiles(orgId);
    const byId = new Map(profs.map((p) => [p.user_id, p]));
    setProfilesById(byId);

    const items: ConvItem[] = rows.map((r) => {
      if (r.conversations.kind === "group") {
        return { id: r.conversation_id, kind: "group", label: r.conversations.name || "Général" };
      }
      const otherId = otherByConv.get(r.conversation_id);
      const p = otherId ? byId.get(otherId) : undefined;
      return { id: r.conversation_id, kind: "dm", label: p?.display_name || "Membre", avatarUrl: p?.avatar_url };
    });
    items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "group" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    setConvs(items);
    setActiveId((cur) => (cur && items.some((i) => i.id === cur) ? cur : (items[0]?.id ?? null)));
  }, [orgId, userId]);

  useEffect(() => { void loadConvs(); }, [loadConvs]);

  const loadMessages = useCallback(async () => {
    if (!activeId) { setMessages([]); return; }
    const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at");
    if (error) return setMsg(error.message);
    setMessages((data ?? []) as Message[]);
  }, [activeId]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  // Pas de websocket : on relit simplement les messages toutes les quelques secondes.
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => { void loadMessages(); }, 4000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !activeId) return;
    const { error } = await supabase.from("messages").insert({ conversation_id: activeId, body: body.trim() });
    if (error) return setMsg(error.message);
    setBody("");
    await loadMessages();
  }

  async function openPicker() {
    if (!orgId) return;
    const profs = await loadOrgMemberProfiles(orgId);
    setMembers(profs.filter((p) => p.user_id !== userId));
    setShowPicker(true);
  }

  async function startDm(otherId: string) {
    setShowPicker(false);
    if (!orgId) return;
    const { data, error } = await supabase.rpc("get_or_create_dm", { p_org: orgId, p_other: otherId });
    if (error) return setMsg(error.message);
    await loadConvs();
    setActiveId(data as string);
  }

  return (
    <>
      <h1>Messagerie</h1>
      <div className="card chat-layout">
        <div>
          <div className="chat-list">
            {convs.map((c) => (
              <button key={c.id} type="button" className={`conv${c.id === activeId ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
                {c.kind === "dm"
                  ? <Avatar url={c.avatarUrl} name={c.label} size={24} />
                  : <span className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>#</span>}
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" className="secondary" onClick={openPicker} style={{ marginTop: ".75rem", width: "100%" }}>
            + Nouveau message
          </button>
          {showPicker && (
            <div className="card" style={{ marginTop: ".5rem" }}>
              {members.length === 0 && <p className="hint">Aucun autre membre dans cette organisation.</p>}
              {members.map((m) => (
                <button
                  key={m.user_id} type="button" className="secondary"
                  style={{ width: "100%", marginBottom: ".4rem", textAlign: "left" }}
                  onClick={() => startDm(m.user_id)}
                >
                  {m.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="chat-thread">
          <div className="chat-messages" ref={scrollRef}>
            {messages.map((m) => {
              const sender = profilesById.get(m.sender_id);
              const mine = m.sender_id === userId;
              return (
                <div key={m.id} className={`chat-bubble${mine ? " mine" : ""}`}>
                  {!mine && <div className="sender">{sender?.display_name || "Membre"}</div>}
                  <div>{m.body}</div>
                  <div className="time">{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              );
            })}
            {messages.length === 0 && <p className="hint">Aucun message pour l'instant.</p>}
          </div>
          <form className="chat-compose" onSubmit={send}>
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écrire un message…" disabled={!activeId} />
            <button type="submit" disabled={!activeId || !body.trim()}>Envoyer</button>
          </form>
        </div>
      </div>
      {msg && <p className="msg">{msg}</p>}
    </>
  );
}
