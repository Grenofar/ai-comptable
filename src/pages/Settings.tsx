import { useState } from "react";
import {
  DEFAULT_GEMINI_MODEL, getGeminiKey, getGeminiModel, setGeminiKey, setGeminiModel,
} from "../lib/geminiKey";

export default function Settings() {
  const [key, setKey] = useState(getGeminiKey());
  const [model, setModel] = useState(getGeminiModel());
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
      <label>Modèle Gemini (par défaut : {DEFAULT_GEMINI_MODEL})
        <input value={model} onChange={(e) => { setModel(e.target.value); setSaved(false); }} />
      </label>
      <div className="row">
        <button onClick={() => { setGeminiKey(key); setGeminiModel(model); setSaved(true); }}>Enregistrer</button>
        <button className="secondary" onClick={() => { setGeminiKey(""); setKey(""); setGeminiModel(""); setModel(DEFAULT_GEMINI_MODEL); setSaved(false); }}>Réinitialiser</button>
      </div>
      {saved && <p className="ok">Réglages enregistrés dans ce navigateur.</p>}
    </div>
  );
}