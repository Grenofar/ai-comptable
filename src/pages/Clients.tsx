import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import type { Client } from "../types";

export default function Clients() {
  const { orgId } = useOrg();
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("clients").select("*").eq("organization_id", orgId).order("name");
    if (error) setMsg(error.message);
    else setClients((data ?? []) as Client[]);
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase.from("clients").insert({ name: name.trim(), email: email.trim() || null, organization_id: orgId });
    if (error) return setMsg(error.message);
    setName(""); setEmail("");
    await load();
  }

  async function remove(c: Client) {
    if (!window.confirm(`Supprimer le client « ${c.name} » ?`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) setMsg("Suppression impossible (documents liés ?) : " + error.message);
    else await load();
  }

  return (
    <>
      <div className="card">
        <h1>Clients</h1>
        <form onSubmit={add} className="row">
          <label>Nom<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button type="submit">Ajouter</button>
        </form>
        {msg && <p className="msg">{msg}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Nom</th><th>E-mail</th><th /></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.email ?? ""}</td>
                <td className="num"><button className="danger" onClick={() => remove(c)}>Supprimer</button></td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={3}>Aucun client.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
