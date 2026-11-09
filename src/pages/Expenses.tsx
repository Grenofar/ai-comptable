import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../lib/org";
import { formatEuro, toCents } from "../lib/money";
import { EXPENSE_CATEGORIES, categorizeExpense } from "../lib/agents";
import type { Expense } from "../types";

export default function Expenses() {
  const { orgId } = useOrg();
  const [items, setItems] = useState<Expense[]>([]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("0");
  const [category, setCategory] = useState("Autre");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("expenses").select("*").eq("organization_id", orgId).order("spent_on", { ascending: false });
    if (error) setMsg(error.message);
    else setItems((data ?? []) as Expense[]);
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);

  // Agent de classement : propose une catégorie, l'utilisateur garde la main.
  async function suggest() {
    setBusy(true); setMsg("");
    try { setCategory(await categorizeExpense(label)); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const cents = toCents(amount);
    if (cents <= 0) return setMsg("Montant invalide.");
    const { error } = await supabase.from("expenses").insert({
      label: label.trim(), category, amount_cents: cents, vat_cents: toCents(vat), organization_id: orgId,
    });
    if (error) return setMsg(error.message);
    setLabel(""); setAmount(""); setVat("0");
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    await load();
  }

  return (
    <>
      <div className="card">
        <h1>Dépenses</h1>
        <form onSubmit={add}>
          <div className="row">
            <label>Libellé<input required value={label} onChange={(e) => setLabel(e.target.value)} /></label>
            <label>Montant TTC (€)<input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label>dont TVA (€)<input inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} /></label>
            <label>Catégorie
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <button type="button" className="secondary" disabled={busy || !label.trim()} onClick={suggest}>
              {busy ? "…" : "Classer avec l'IA"}
            </button>
            <button type="submit">Ajouter</button>
          </div>
        </form>
        {msg && <p className="msg">{msg}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th className="num">TTC</th><th /></tr></thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{x.spent_on}</td><td>{x.label}</td><td>{x.category}</td>
                <td className="num">{formatEuro(x.amount_cents)}</td>
                <td className="num"><button className="danger" onClick={() => remove(x.id)}>×</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5}>Aucune dépense.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
