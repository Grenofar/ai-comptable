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
  const iss = doc.issuer_snapshot;
  const issuerBlock = iss
    ? `<p class="issuer"><b>${esc(iss.legal_name ?? "")}</b>${iss.legal_form ? ` — ${esc(iss.legal_form)}` : ""}<br>
${iss.address ? `${esc(iss.address)}<br>` : ""}
${iss.siret ? `SIRET : ${esc(iss.siret)}<br>` : ""}
${iss.vat_number ? `TVA intracommunautaire : ${esc(iss.vat_number)}<br>` : ""}
${[iss.email, iss.phone].filter((v): v is string => Boolean(v)).map(esc).join(" · ")}</p>`
    : `<p class="issuer warn">Aucune information d'émetteur enregistrée (menu Réglages) : ce document ne comporte pas les mentions légales obligatoires.</p>`;
  const footerBlock = iss
    ? [
        iss.iban ? `<p>Règlement par virement — IBAN : ${esc(iss.iban)}</p>` : "",
        iss.payment_terms ? `<p>${esc(iss.payment_terms)}</p>` : "",
        iss.legal_notice ? `<p class="legal">${esc(iss.legal_notice)}</p>` : "",
      ].join("")
    : "";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} ${esc(doc.number ?? "brouillon")}</title>
<style>
body{font-family:sans-serif;margin:2rem;color:#1c2430}
table{width:100%;border-collapse:collapse}
th,td{border-bottom:1px solid #ccc;padding:.4rem;text-align:left}
.t{text-align:right;margin-top:1rem}
.issuer{font-size:.85rem;color:#444;margin-bottom:1.5rem}
.issuer.warn{color:#b45309}
.legal{font-size:.75rem;color:#666;margin-top:2rem;border-top:1px solid #e5e9f0;padding-top:.75rem}
</style></head>
<body>
${issuerBlock}
<h1>${esc(title)} ${esc(doc.number ?? "(brouillon)")}</h1>
<p>Client : ${esc(doc.clients?.name ?? "")}<br>Date : ${esc(doc.issue_date)}${doc.due_date ? `<br>Échéance : ${esc(doc.due_date)}` : ""}</p>
<table><thead><tr><th>Description</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>${rows}</tbody></table>
<p class="t">Total HT : ${formatEuro(doc.subtotal_cents)}<br>TVA : ${formatEuro(doc.vat_cents)}<br><b>Total TTC : ${formatEuro(doc.total_cents)}</b></p>
${doc.notes ? `<p>${esc(doc.notes)}</p>` : ""}
${footerBlock}
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) throw new Error("Autorisez les fenêtres pop-up pour imprimer.");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
