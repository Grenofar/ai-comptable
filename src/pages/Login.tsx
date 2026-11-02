import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setMsg("Erreur : " + error.message);
    else if (mode === "up") setMsg("Compte créé. Vérifiez votre e-mail si une confirmation est demandée.");
  }

  return (
    <main className="card narrow">
      <h1>AI Comptable</h1>
      <form onSubmit={submit}>
        <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Mot de passe<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit">{mode === "in" ? "Se connecter" : "Créer un compte"}</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
      <button className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
      </button>
    </main>
  );
}
