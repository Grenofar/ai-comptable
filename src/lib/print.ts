import { supabase } from "./supabase";
import { formatEuro, lineTotals } from "./money";
import type { Doc, DocumentLine } from "../types";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Ouvre une page imprimable : l'utilisateur choisit « Enregistrer au format PDF ».
export async function printDocument(doc: Doc): Promise<void> {
  const { data, error } = await supabase.from("document_lines").select("*").eq("document_id", doc.id).order("position");
  if (error) throw new Error(error.message);
  const lines = (data ?? []) as DocumentLine[];
  const title = doc.type === "quote" ? "Devis" : "Facture";
  const rows = lines.map((l) => {
    const t = lineTotals(l);
    return `<tr><td>${esc(l.description)}</td><td>${l.quantity}</td><td>${formatEuro(l.unit_price_cents)}</td><td>${l.vat_rate} %</td><td>${formatEuro(t.sub)}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} ${esc(doc.number ?? "brouillon")}</title>
<style>body{font-family:sans-serif;margin:2rem}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:.4rem;text-align:left}.t{text-align:right;margin-top:1rem}</style></head>
<body><h1>${esc(title)} ${esc(doc.number ?? "(brouillon)")}</h1>
<p>Client : ${esc(doc.clients?.name ?? "")}<br>Date : ${esc(doc.issue_date)}${doc.due_date ? `<br>Échéance : ${esc(doc.due_date)}` : ""}</p>
<table><thead><tr><th>Description</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>${rows}</tbody></table>
<p class="t">Total HT : ${formatEuro(doc.subtotal_cents)}<br>TVA : ${formatEuro(doc.vat_cents)}<br><b>Total TTC : ${formatEuro(doc.total_cents)}</b></p>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) throw new Error("Autorisez les fenêtres pop-up pour imprimer.");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
