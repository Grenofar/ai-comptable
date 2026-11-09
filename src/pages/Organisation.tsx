import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import Avatar from "../components/Avatar";
import type { JoinRequest, OrgMember, OrgRole, Profile } from "../types";

const ROLE_FR: Record<OrgRole, string> = { owner: "Propriétaire", admin: "Administrateur", member: "Membre" };

export default function Organisation() {
  const { orgId, orgName, role, orgs, setOrgId, reload } = useOrg();
  const canManage = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [msg, setMsg] = useState("");

  const [name, setName] = useState(orgName ?? "");
  const [nameMsg, setNameMsg] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviting, setInviting] = useState(false);

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgMsg, setNewOrgMsg] = useState("");

  const [joinName, setJoinName] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState(false);

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [reqMsg, setReqMsg] = useState("");

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    const { data: mems, error } = await supabase
      .from("organization_members").select("user_id, role, created_at")
      .eq("organization_id", orgId).order("created_at");
    if (error) return setMsg(error.message);
    const ids = (mems ?? []).map((m) => m.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids)
      : { data: [] as { user_id: string; display_name: string; avatar_url: string | null }[] };
    const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
    setMembers((mems ?? []).map((m) => ({ ...m, profiles: byId.get(m.user_id) ?? null })) as OrgMember[]);
  }, [orgId]);

  const loadRequests = useCallback(async () => {
    if (!orgId || !canManage) { setRequests([]); return; }
    const { data: reqs, error } = await supabase
      .from("organization_join_requests").select("id, organization_id, user_id, status, created_at")
      .eq("organization_id", orgId).eq("status", "pending").order("created_at");
    if (error) return setReqMsg(error.message);
    const ids = (reqs ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("*").in("user_id", ids)
      : { data: [] as Profile[] };
    const byId = new Map((profs ?? []).map((p) => [p.user_id, p as Profile]));
    setRequests((reqs ?? []).map((r) => ({ ...r, requester: byId.get(r.user_id) ?? null })) as JoinRequest[]);
  }, [orgId, canManage]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);
  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useEffect(() => { setName(orgName ?? ""); }, [orgName]);

  async function rename(e: FormEvent) {
    e.preventDefault();
    setNameMsg("");
    const { error } = await supabase.from("organizations").update({ name: name.trim() }).eq("id", orgId);
    if (error) return setNameMsg(error.message);
    setNameMsg("Nom enregistré.");
    await reload();
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setInviteMsg(""); setInviting(true);
    const { error } = await supabase.rpc("invite_member_by_email", {
      p_org: orgId, p_email: inviteEmail.trim(), p_role: inviteRole,
    });
    setInviting(false);
    if (error) return setInviteMsg(error.message);
    setInviteEmail(""); setInviteMsg("Membre ajouté.");
    await loadMembers();
  }

  async function changeRole(userId: string, newRole: OrgRole) {
    setMsg("");
    const { error } = await supabase.from("organization_members").update({ role: newRole })
      .eq("organization_id", orgId).eq("user_id", userId);
    if (error) setMsg(error.message);
    else await loadMembers();
  }

  async function removeMember(userId: string, name: string) {
    if (!window.confirm(`Retirer ${name} de l'organisation ?`)) return;
    setMsg("");
    const { error } = await supabase.from("organization_members").delete()
      .eq("organization_id", orgId).eq("user_id", userId);
    if (error) setMsg(error.message);
    else await loadMembers();
  }

  async function leave() {
    if (!window.confirm("Quitter cette organisation ?")) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = await supabase.from("organization_members").delete()
      .eq("organization_id", orgId).eq("user_id", uid);
    if (error) return setMsg(error.message);
    await reload();
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setJoinMsg(""); setJoining(true);
    const { error } = await supabase.rpc("request_to_join_organization", { p_name: joinName.trim() });
    setJoining(false);
    if (error) return setJoinMsg(error.message);
    setJoinName("");
    setJoinMsg("Demande envoyée : un responsable de l'organisation doit l'accepter.");
  }

  async function decide(id: string, accept: boolean) {
    setReqMsg("");
    const { error } = await supabase.rpc("decide_join_request", { p_request: id, p_accept: accept });
    if (error) return setReqMsg(error.message);
    await loadRequests();
    if (accept) await loadMembers();
  }

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    setNewOrgMsg("");
    if (!newOrgName.trim()) return setNewOrgMsg("Donnez un nom à l'organisation.");
    const { data, error } = await supabase.from("organizations").insert({ name: newOrgName.trim() }).select("id").single();
    if (error || !data) return setNewOrgMsg(error?.message ?? "Erreur.");
    setNewOrgName("");
    await reload();
    setOrgId(data.id);
  }

  return (
    <>
      <h1>Organisation</h1>

      <div className="card">
        <h2>Nom de l'organisation</h2>
        {canManage ? (
          <form onSubmit={rename} className="row">
            <label>Nom<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <button type="submit">Renommer</button>
          </form>
        ) : (
          <p>{orgName}</p>
        )}
        {nameMsg && <p className="ok">{nameMsg}</p>}
      </div>

      <div className="card">
        <h2>Membres</h2>
        {members.map((m) => (
          <div className="member-row" key={m.user_id}>
            <div className="who">
              <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={32} />
              <span className="name">{m.profiles?.display_name || "Utilisateur"}</span>
            </div>
            {canManage && m.role !== "owner" ? (
              <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value as OrgRole)}>
                <option value="admin">Administrateur</option>
                <option value="member">Membre</option>
              </select>
            ) : (
              <span className={`badge role-${m.role}`}>{ROLE_FR[m.role]}</span>
            )}
            {canManage && m.role !== "owner" && (
              <button className="danger" onClick={() => removeMember(m.user_id, m.profiles?.display_name || "ce membre")}>Retirer</button>
            )}
          </div>
        ))}
        {msg && <p className="msg">{msg}</p>}
        {!isOwner && <button className="secondary" onClick={leave} style={{ marginTop: "1rem" }}>Quitter cette organisation</button>}
      </div>

      {canManage && requests.length > 0 && (
        <div className="card">
          <h2>Demandes en attente ({requests.length})</h2>
          {requests.map((r) => (
            <div className="member-row" key={r.id}>
              <div className="who">
                <Avatar url={r.requester?.avatar_url} name={r.requester?.display_name} size={32} />
                <div>
                  <div className="name">{r.requester?.display_name || "Utilisateur"}</div>
                  {r.requester?.bio && <div className="email">{r.requester.bio}</div>}
                </div>
              </div>
              <button onClick={() => decide(r.id, true)}>Accepter</button>
              <button className="danger" onClick={() => decide(r.id, false)}>Refuser</button>
            </div>
          ))}
          {reqMsg && <p className="msg">{reqMsg}</p>}
        </div>
      )}

      {canManage && (
        <div className="card">
          <h2>Inviter un membre</h2>
          <p className="hint">
            La personne doit déjà avoir un compte AI Comptable (avec cette adresse e-mail) pour pouvoir
            être ajoutée.
          </p>
          <form onSubmit={invite} className="row">
            <label>E-mail
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </label>
            <label>Rôle
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}>
                <option value="member">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
            </label>
            <button type="submit" disabled={inviting}>{inviting ? "…" : "Inviter"}</button>
          </form>
          {inviteMsg && <p className={inviteMsg === "Membre ajouté." ? "ok" : "msg"}>{inviteMsg}</p>}
        </div>
      )}

      <div className="card">
        <h2>Rejoindre une organisation</h2>
        <p className="hint">Saisissez le nom exact d'une organisation : un responsable devra accepter votre demande.</p>
        <form onSubmit={join} className="row">
          <label>Nom de l'organisation<input value={joinName} onChange={(e) => setJoinName(e.target.value)} required /></label>
          <button type="submit" disabled={joining}>{joining ? "…" : "Demander à rejoindre"}</button>
        </form>
        {joinMsg && <p className={joinMsg.startsWith("Demande envoyée") ? "ok" : "msg"}>{joinMsg}</p>}
      </div>

      <div className="card">
        <h2>Créer une nouvelle organisation</h2>
        <form onSubmit={createOrg} className="row">
          <label>Nom<input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Ex. Studio Martin" /></label>
          <button type="submit">Créer</button>
        </form>
        {newOrgMsg && <p className="msg">{newOrgMsg}</p>}
        <p className="hint">Vous êtes membre de {orgs.length} organisation{orgs.length > 1 ? "s" : ""}. Changez d'organisation active depuis le menu en haut de la navigation.</p>
      </div>
    </>
  );
}
