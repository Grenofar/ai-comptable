import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import Avatar from "../components/Avatar";
import type { OrgMember, OrgRole } from "../types";

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

  useEffect(() => { void loadMembers(); }, [loadMembers]);
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
