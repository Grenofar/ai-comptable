import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Documents from "./pages/Documents";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return (
      <main className="card narrow">
        <h1>Configuration requise</h1>
        <p>Définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local, puis relancez.</p>
      </main>
    );
  }
  if (!ready) return <main className="card narrow">Chargement…</main>;
  if (!session) return <Login />;

  return (
    <div className="layout">
      <nav>
        <strong>AI Comptable</strong>
        <NavLink to="/">Tableau de bord</NavLink>
        <NavLink to="/clients">Clients</NavLink>
        <NavLink to="/devis">Devis</NavLink>
        <NavLink to="/factures">Factures</NavLink>
        <NavLink to="/depenses">Dépenses</NavLink>
        <NavLink to="/reglages">Réglages</NavLink>
        <button className="link" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/devis" element={<Documents type="quote" />} />
          <Route path="/factures" element={<Documents type="invoice" />} />
          <Route path="/depenses" element={<Expenses />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
