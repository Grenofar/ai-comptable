import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { getGeminiKey } from "./lib/geminiKey";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Documents from "./pages/Documents";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import { Cgu, Confidentialite, MentionsLegales } from "./pages/Legal";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (session) setHasGeminiKey(Boolean(getGeminiKey()));
  }, [session, location]);

  if (!supabaseConfigured) {
    return (
      <main className="card narrow">
        <h1>Configuration requise</h1>
        <p>Définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local, puis relancez.</p>
      </main>
    );
  }

  const legalRoutes = (
    <>
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/cgu" element={<Cgu />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
    </>
  );

  if (!ready) return <main className="card narrow">Chargement…</main>;
  if (!session) {
    return (
      <Routes>
        {legalRoutes}
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

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
        {!hasGeminiKey && (
          <div className="banner">
            <span>Aucune clé API Gemini enregistrée : les assistants IA sont désactivés.</span>
            <NavLink to="/reglages">Ajouter ma clé</NavLink>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/devis" element={<Documents type="quote" />} />
          <Route path="/factures" element={<Documents type="invoice" />} />
          <Route path="/depenses" element={<Expenses />} />
          <Route path="/reglages" element={<Settings />} />
          {legalRoutes}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer className="legal-footer">
          <NavLink to="/mentions-legales">Mentions légales</NavLink>
          <NavLink to="/cgu">CGU</NavLink>
          <NavLink to="/confidentialite">Confidentialité</NavLink>
        </footer>
      </main>
    </div>
  );
}
