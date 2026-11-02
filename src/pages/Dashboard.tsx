import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatEuro } from "../lib/money";

interface Stats { invoiced: number; paid: number; outstanding: number; expenses: number; overdue: number }

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const year = new Date().getFullYear();
      const from = `${year}-01-01`;
      const [inv, pay, exp] = await Promise.all([
        supabase.from("documents").select("total_cents,status,due_date").eq("type", "invoice").gte("issue_date", from),
        supabase.from("payments").select("amount_cents").gte("paid_on", from),
        supabase.from("expenses").select("amount_cents").gte("spent_on", from),
      ]);
      const err = inv.error ?? pay.error ?? exp.error;
      if (err) return setMsg(err.message);
      const issued = (inv.data ?? []).filter((d) => d.status !== "draft" && d.status !== "cancelled");
      const invoiced = issued.reduce((a, d) => a + d.total_cents, 0);
      const paid = (pay.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
      const today = new Date().toISOString().slice(0, 10);
      const overdue = issued.filter((d) => d.status !== "paid" && d.due_date && d.due_date < today).length;
      setS({
        invoiced, paid, outstanding: Math.max(invoiced - paid, 0),
        expenses: (exp.data ?? []).reduce((a, e) => a + e.amount_cents, 0), overdue,
      });
    })();
  }, []);

  if (msg) return <p className="msg">{msg}</p>;
  if (!s) return <p>Chargement…</p>;
  return (
    <>
      <h1>Tableau de bord {new Date().getFullYear()}</h1>
      <div className="stats">
        <div className="card stat">Facturé<b>{formatEuro(s.invoiced)}</b></div>
        <div className="card stat">Encaissé<b>{formatEuro(s.paid)}</b></div>
        <div className="card stat">Reste à encaisser<b>{formatEuro(s.outstanding)}</b></div>
        <div className="card stat">Dépenses<b>{formatEuro(s.expenses)}</b></div>
        <div className="card stat">Factures en retard<b>{s.overdue}</b></div>
      </div>
    </>
  );
}
