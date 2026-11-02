// Tous les montants sont des entiers en centimes.
export function toCents(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function lineTotals(l: { quantity: number; unit_price_cents: number; vat_rate: number }) {
  const sub = Math.round(l.quantity * l.unit_price_cents);
  const vat = Math.round((sub * l.vat_rate) / 100);
  return { sub, vat, total: sub + vat };
}

export function documentTotals(lines: { quantity: number; unit_price_cents: number; vat_rate: number }[]) {
  return lines.reduce(
    (acc, l) => {
      const t = lineTotals(l);
      return { sub: acc.sub + t.sub, vat: acc.vat + t.vat, total: acc.total + t.total };
    },
    { sub: 0, vat: 0, total: 0 },
  );
}
