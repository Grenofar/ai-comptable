import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg("Erreur : " + error.message);
    else if (mode === "up") setMsg("Compte créé. Vérifiez votre e-mail si une confirmation est demandée.");
  }

  async function withGoogle() {
    setMsg("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMsg("Erreur : " + error.message);
      setBusy(false);
    }
    // En cas de succès, le navigateur est redirigé vers Google : rien d'autre à faire ici.
  }

  return (
    <main className="card narrow">
      <h1>AI Comptable</h1>
      <button type="button" className="secondary google-btn" disabled={busy} onClick={withGoogle}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.4-6.4C35.6 3 30.1 1 24 1 14.8 1 6.9 6.5 3.3 14.3l7.4 5.7C12.5 14 17.8 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v8.1h12.9c-.3 2.2-1.6 5.5-4.6 7.7l7.1 5.5c4.2-3.9 6.1-9.6 6.1-17.3z" />
          <path fill="#FBBC05" d="M10.7 20c-.6 1.7-.9 3.6-.9 5.5s.3 3.8.9 5.5l-7.4 5.7C1.2 33.2 0 29.5 0 25.5s1.2-7.7 3.3-11.2l7.4 5.7z" />
          <path fill="#34A853" d="M24 48c6.1 0 11.6-2 15.4-5.7l-7.1-5.5c-2 1.4-4.8 2.4-8.3 2.4-6.2 0-11.5-4.5-13.3-10.5l-7.4 5.7C6.9 41.5 14.8 48 24 48z" />
        </svg>
        Continuer avec Google
      </button>
      <div className="divider">ou</div>
      <form onSubmit={submit}>
        <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Mot de passe<input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer un compte"}</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
      <button className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
      </button>
      <p className="hint">
        Vos données de comptabilité sont chiffrées et isolées par compte (RLS Supabase). Votre clé
        API Gemini, elle, reste uniquement dans ce navigateur : elle vous sera demandée dans Réglages.
      </p>
      <p className="legal-footer">
        En continuant, vous acceptez les <Link to="/cgu">CGU</Link> et la{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>
    </main>
  );
}
