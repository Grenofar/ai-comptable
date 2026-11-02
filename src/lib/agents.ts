import { askGeminiJson } from "./gemini";
import type { DocumentLine } from "../types";
import { toCents } from "./money";

// Les sorties IA sont non fiables : tout est validé avant utilisation.
const MAX_LINES = 50;
const MAX_UNIT_CENTS = 100_000_000;

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

export function validateLines(raw: unknown): DocumentLine[] {
  const arr = (raw as { lines?: unknown })?.lines;
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("Aucune ligne proposée par l'IA.");
  return arr.slice(0, MAX_LINES).map((l, i) => {
    const o = l as Record<string, unknown>;
    const description = str(o.description);
    const quantity = num(o.quantity);
    const price = num(o.unit_price_eur);
    const vat = num(o.vat_rate);
    if (!description) throw new Error(`Ligne ${i + 1} : description invalide.`);
    if (!(quantity > 0 && quantity <= 100000)) throw new Error(`Ligne ${i + 1} : quantité invalide.`);
    if (!(price >= 0) || toCents(price) > MAX_UNIT_CENTS) throw new Error(`Ligne ${i + 1} : prix invalide.`);
    if (!(vat >= 0 && vat <= 100)) throw new Error(`Ligne ${i + 1} : TVA invalide.`);
    return { description, quantity, unit_price_cents: toCents(price), vat_rate: vat };
  });
}

// Agent de rédaction : description libre -> lignes de devis ou de facture.
export async function draftLines(description: string): Promise<DocumentLine[]> {
  const prompt =
    `Tu es un assistant comptable français. À partir de la demande ci-dessous, produis les lignes d'un devis ou d'une facture. ` +
    `Réponds uniquement en JSON : {"lines":[{"description":string,"quantity":number,"unit_price_eur":number,"vat_rate":number}]}. ` +
    `TVA par défaut 20. N'invente pas de prix si la demande n'en donne pas : mets 0.\n\nDemande :\n` +
    description.slice(0, 2000);
  return validateLines(await askGeminiJson(prompt));
}

export const EXPENSE_CATEGORIES = [
  "Matériel", "Logiciels", "Déplacements", "Repas", "Loyer", "Assurance",
  "Services", "Marketing", "Impôts et taxes", "Autre",
];

// Agent de classement : propose une catégorie pour une dépense.
export async function categorizeExpense(label: string): Promise<string> {
  const prompt =
    `Classe cette dépense dans exactement une catégorie de cette liste : ${EXPENSE_CATEGORIES.join(", ")}. ` +
    `Réponds en JSON : {"category":string}.\n\nDépense : ${label.slice(0, 200)}`;
  const out = (await askGeminiJson(prompt)) as { category?: unknown };
  const cat = str(out?.category, 60);
  return EXPENSE_CATEGORIES.includes(cat) ? cat : "Autre";
}

// Agent de relance : prépare un texte, l'utilisateur valide et envoie lui-même.
export async function draftReminder(p: {
  clientName: string; number: string; amountEur: string; dueDate: string; daysLate: number;
}): Promise<{ subject: string; body: string }> {
  const prompt =
    `Rédige en français une relance courtoise pour une facture impayée. Données : client ${p.clientName}, ` +
    `facture ${p.number}, montant ${p.amountEur}, échéance ${p.dueDate}, retard ${p.daysLate} jours. ` +
    `Ton professionnel, sans menace. Réponds en JSON : {"subject":string,"body":string}.`;
  const out = (await askGeminiJson(prompt)) as { subject?: unknown; body?: unknown };
  const subject = str(out?.subject, 200);
  const body = str(out?.body, 3000);
  if (!subject || !body) throw new Error("Relance invalide.");
  return { subject, body };
}
