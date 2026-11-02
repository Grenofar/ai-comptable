import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { documentTotals, formatEuro, toCents } from "../lib/money";
import { draftLines } from "../lib/agents";
import type { Client, DocType, DocumentLine } from "../types";

interface Props { type: DocType; onCreated: () => void }

const emptyLine = (): DocumentLine => ({ description: "", quantity: 1, unit_price_cents: 0, vat_rate: 20 });

export default function DocumentForm({ type, onCreated }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<DocumentLine[]>([emptyLine()]);
  const [prompt, setPrompt] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("*").order("name").then(({ data }) => setClients((data ?? []) as Client[]));
  }, []);

  const totals = documentTotals(lines);
  const patch = (i: number, p: Partial<DocumentLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  // Agent de rédaction : propose des lignes, l'utilisateur relit avant d'enregistrer.
  async function ai() {
    setBusy(true); setMsg("");
    try { setLines(await draftLines(prompt)); setMsg("Lignes proposées par l'IA : relisez-les avant d'enregistrer."); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const valid = lines.filter((l) => l.description.trim());
    if (!clientId) return setMsg("Choisissez un client.");
    if (valid.length === 0) return setMsg("Ajoutez au moins une ligne.");
    const { data: doc, error } = await supabase.from("documents")
      .insert({ client_id: clientId, type, due_date: dueDate || null }).select("id").single();
    if (error || !doc) return setMsg(error?.message ?? "Erreur.");
    const { error: e2 } = await supabase.from("document_lines").insert(
      valid.map((l, i) => ({ ...l, document_id: doc.id, position: i })),
    );
    if (e2) {
      await supabase.from("documents").delete().eq("id", doc.id);
      return setMsg(e2.message);
    }
    setLines([emptyLine()]); setPrompt(""); setDueDate("");
    onCreated();
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>Nouveau {type === "quote" ? "devis" : "facture"} (brouillon)</h2>
      <div className="row">
        <label>Client
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— choisir —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Échéance<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      </div>
      <label>Décrire en langage naturel (agent de rédaction)
        <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <button type="button" className="secondary" disabled={busy || !prompt.trim()} onClick={ai}>
        {busy ? "Rédaction…" : "Rédiger avec l'IA"}
      </button>
      <table>
        <thead><tr><th>Description</th><th>Qté</th><th>PU HT (€)</th><th>TVA %</th><th /></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><input value={l.description} onChange={(e) => patch(i, { description: e.target.value })} /></td>
              <td><input size={4} inputMode="decimal" value={l.quantity} onChange={(e) => patch(i, { quantity: parseFloat(e.target.value) || 0 })} /></td>
              <td><input size={8} inputMode="decimal" defaultValue={(l.unit_price_cents / 100).toString()} key={l.unit_price_cents} onBlur={(e) => patch(i, { unit_price_cents: toCents(e.target.value) })} /></td>
              <td><input size={4} inputMode="decimal" value={l.vat_rate} onChange={(e) => patch(i, { vat_rate: parseFloat(e.target.value) || 0 })} /></td>
              <td><button type="button" className="danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button type="button" className="secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>+ Ligne</button>
        <span>HT {formatEuro(totals.sub)} · TVA {formatEuro(totals.vat)} · <b>TTC {formatEuro(totals.total)}</b></span>
        <button type="submit">Enregistrer le brouillon</button>
      </div>
      {msg && <p className="msg">{msg}</p>}
    </form>
  );
}
