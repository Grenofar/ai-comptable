import { useState } from "react";
import { getGeminiKey, setGeminiKey } from "../lib/geminiKey";

export default function Settings() {
  const [key, setKey] = useState(getGeminiKey());
  const [saved, setSaved] = useState(false);

  return (
    <div className="card">
      <h1>Réglages</h1>
      <p>
        La clé Gemini est stockée uniquement dans ce navigateur. Elle n'est jamais envoyée à nos
        serveurs ni enregistrée en base.
      </p>
      <label>Clé API Gemini
        <input type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} />
      </label>
      <div className="row">
        <button onClick={() => { setGeminiKey(key); setSaved(true); }}>Enregistrer</button>
        <button className="secondary" onClick={() => { setGeminiKey(""); setKey(""); setSaved(false); }}>Effacer</button>
      </div>
      {saved && <p className="ok">Clé enregistrée dans ce navigateur.</p>}
    </div>
  );
}
