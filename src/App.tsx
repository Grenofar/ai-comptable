import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { getGeminiKey } from "./lib/geminiKey";
import { OrgProvider, useOrg } from "./lib/org";
import Avatar from "./components/Avatar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Documents from "./pages/Documents";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import Organisation from "./pages/Organisation";
import Profil from "./pages/Profil";
import Messages from "./pages/Messages";
import Tasks from "./pages/Tasks";
import { Cgu, Confidentialite, MentionsLegales } from "./pages/Legal";
import type { Profile } from "./types";

const legalRoutes = (
  <>
    <Route path="/mentions-legales" element={<MentionsLegales />} />
    <Route path="/cgu" element={<Cgu />} />
    <Route path="/confidentialite" element={<Confidentialite />} />
  </>
);

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

  if (!session) {
    return (
      <Routes>
        {legalRoutes}
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <OrgProvider>
      <AuthedLayout />
    </OrgProvider>
  );
}

function AuthedLayout() {
  const { orgs, orgId, role, loading, setOrgId } = useOrg();
  const [hasGeminiKey, setHasGeminiKey] = useState(true);
  const [me, setMe] = useState<Profile | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const location = useLocation();
  const canManage = role === "owner" || role === "admin";

  useEffect(() => { setHasGeminiKey(Boolean(getGeminiKey())); }, [location]);

  useEffect(() => {
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => setMe(data as Profile | null));
  }, [location]);

  useEffect(() => {
    if (!orgId || !canManage) { setPendingRequests(0); return; }
    supabase.from("organization_join_requests").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("status", "pending")
      .then(({ count }) => setPendingRequests(count ?? 0));
  }, [orgId, canManage, location]);

  if (loading) return <main className="card narrow">Chargement…</main>;

  return (
    <div className="layout">
      <nav>
        <div className="nav-top">
          <div className="brand">
            <img src="/favicon.svg" alt="" />
            <strong>AI Comptable</strong>
          </div>
          {orgs.length > 0 && (
            <div className="org-switcher">
              <select value={orgId ?? ""} onChange={(e) => setOrgId(e.target.value)}>
                {orgs.map((o) => (
                  <option key={o.organization_id} value={o.organization_id}>{o.organizations?.name ?? "Organisation"}</option>
                ))}
              </select>
            </div>
          )}
          <NavLink to="/">Tableau de bord</NavLink>
          <NavLink to="/clients">Clients</NavLink>
          <NavLink to="/devis">Devis</NavLink>
          <NavLink to="/factures">Factures</NavLink>
          <NavLink to="/depenses">Dépenses</NavLink>
          <NavLink to="/taches">Tâches</NavLink>
          <NavLink to="/messages">Messagerie</NavLink>
          <NavLink to="/organisation">Organisation{pendingRequests > 0 && <span className="badge role-admin">{pendingRequests}</span>}</NavLink>
          <NavLink to="/reglages">Réglages</NavLink>
        </div>
        <div className="nav-bottom">
          <NavLink to="/profil" className="nav-me">
            <Avatar url={me?.avatar_url} name={me?.display_name} size={28} />
            <span className="nav-me-name">{me?.display_name || "Mon profil"}</span>
          </NavLink>
          <button className="nav-logout" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
        </div>
      </nav>
      <main>
        {me && !me.bio && location.pathname !== "/profil" && (
          <div className="banner">
            <span>Complétez votre profil : ajoutez une courte bio pour que vos collègues sachent qui vous êtes.</span>
            <NavLink to="/profil">Compléter mon profil</NavLink>
          </div>
        )}
        {!hasGeminiKey && (
          <div className="banner">
            <span>Aucune clé API Gemini enregistrée : les assistants IA sont désactivés.</span>
            <NavLink to="/reglages">Ajouter ma clé</NavLink>
          </div>
        )}
        <Routes>
          <Route path="/organisation" element={<Organisation />} />
          <Route path="/profil" element={<Profil />} />
          {legalRoutes}
          {orgId ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/devis" element={<Documents type="quote" />} />
              <Route path="/factures" element={<Documents type="invoice" />} />
              <Route path="/depenses" element={<Expenses />} />
              <Route path="/taches" element={<Tasks />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/reglages" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/organisation" replace />} />
          )}
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
