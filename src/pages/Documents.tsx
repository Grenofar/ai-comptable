import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import { formatEuro, toCents } from "../lib/money";
import { draftReminder } from "../lib/agents";
import { printDocument } from "../lib/print";
import type { Doc, DocType } from "../types";
import DocumentForm from "./DocumentForm";

const STATUS_FR: Record<string, string> = {
  draft: "Brouillon", sent: "Émis", accepted: "Accepté", rejected: "Refusé", paid: "Payée", cancelled: "Annulé",
};

export default function Documents({ type }: { type: DocType }) {
  const { orgId } = useOrg();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [msg, setMsg] = useState("");
  const [reminder, setReminder] = useState<{ subject: string; body: string } | null>(null);
  const [editing, setEditing] = useState<Doc | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("documents").select("*, clients(name)")
      .eq("organization_id", orgId).eq("type", type).order("created_at", { ascending: false });
    if (error) setMsg(error.message);
    else setDocs((data ?? []) as Doc[]);
  }, [type, orgId]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setMsg("");
    try { await fn(); await load(); } catch (e) { setMsg((e as Error).message); }
  }

  const setStatus = (d: Doc, status: string, confirm: string) =>
    run(async () => {
      if (!window.confirm(confirm)) return;
      const { error } = await supabase.from("documents").update({ status }).eq("id", d.id);
      if (error) throw new Error(error.message);
    });

  const addPayment = (d: Doc) =>
    run(async () => {
      const v = window.prompt(`Montant reçu (€), reste dû : ${formatEuro(d.total_cents)}`);
      if (!v) return;
      const cents = toCents(v);
      if (cents <= 0) throw new Error("Montant invalide.");
      const { error } = await supabase.from("payments").insert({ document_id: d.id, amount_cents: cents, organization_id: d.organization_id });
      if (error) throw new Error(error.message);
    });

  const convertToInvoice = (d: Doc) =>
    run(async () => {
      if (!window.confirm("Créer une facture brouillon à partir de ce devis accepté ?")) return;
      const { error } = await supabase.rpc("convert_quote_to_invoice", { p_quote: d.id });
      if (error) throw new Error(error.message);
      setMsg("Facture brouillon créée à partir du devis : retrouvez-la dans l'onglet Factures.");
    });

  // Agent de relance : prépare le texte, aucun envoi automatique.
  const remind = (d: Doc) =>
    run(async () => {
      const due = d.due_date ?? d.issue_date;
      const days = Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 86400000));
      setReminder(await draftReminder({
        clientName: d.clients?.name ?? "", number: d.number ?? "", amountEur: formatEuro(d.total_cents),
        dueDate: due, daysLate: days,
      }));
    });

  const label = type === "quote" ? "Devis" : "Factures";
  return (
    <>
      <h1>{label}</h1>
      <DocumentForm type={type} onCreated={load} editDoc={editing} onCancelEdit={() => setEditing(null)} />
      {msg && <p className="msg">{msg}</p>}
      {reminder && (
        <div className="card">
          <h2>Relance proposée (à relire avant envoi)</h2>
          <p><b>{reminder.subject}</b></p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{reminder.body}</pre>
          <button className="secondary" onClick={() => setReminder(null)}>Fermer</button>
        </div>
      )}
      <div className="card">
        <table>
          <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Statut</th><th className="num">TTC</th><th /></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.number ?? "—"}</td>
                <td>{d.clients?.name}</td>
                <td>{d.issue_date}</td>
                <td><span className="badge">{STATUS_FR[d.status]}</span></td>
                <td className="num">{formatEuro(d.total_cents)}</td>
                <td className="row">
                  {d.status === "draft" && (<>
                    <button className="secondary" onClick={() => setEditing(d)}>Modifier</button>
                    <button onClick={() => setStatus(d, "sent", "Émettre ce document ? Un numéro définitif sera attribué.")}>Émettre</button>
                    <button className="danger" onClick={() => run(async () => { if (window.confirm("Supprimer ce brouillon ?")) await supabase.from("documents").delete().eq("id", d.id); })}>Supprimer</button>
                  </>)}
                  {type === "quote" && d.status === "sent" && (<>
                    <button onClick={() => setStatus(d, "accepted", "Marquer comme accepté ?")}>Accepté</button>
                    <button className="secondary" onClick={() => setStatus(d, "rejected", "Marquer comme refusé ?")}>Refusé</button>
                  </>)}
                  {type === "quote" && d.status === "accepted" && (
                    <button onClick={() => convertToInvoice(d)}>Convertir en facture</button>
                  )}
                  {type === "invoice" && (d.status === "sent") && (<>
                    <button onClick={() => addPayment(d)}>Paiement</button>
                    <button className="secondary" onClick={() => remind(d)}>Relance IA</button>
                  </>)}
                  {d.number && d.status !== "paid" && d.status !== "cancelled" && (
                    <button className="secondary" onClick={() => setStatus(d, "cancelled", "Annuler ce document ?")}>Annuler</button>
                  )}
                  <button className="secondary" onClick={() => run(() => printDocument(d))}>PDF</button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={6}>Aucun document.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
