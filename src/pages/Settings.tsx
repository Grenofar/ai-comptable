import { useEffect, useState } from "react";
import {
  DEFAULT_GEMINI_MODEL, getGeminiKey, getGeminiModel, setGeminiKey, setGeminiModel,
} from "../lib/geminiKey";
import { supabase } from "../lib/supabase";
import type { IssuerProfile } from "../types";

const MODEL_OPTIONS = [
  { value: "gemini-3.8-flash", label: "gemini-3.8-flash — rapide (par défaut)" },
  { value: "gemini-3.8-pro", label: "gemini-3.8-pro — plus précis, plus lent" },
  { value: "gemini-3.0-flash", label: "gemini-3.0-flash" },
];
const CUSTOM = "__custom__";

const emptyProfile: IssuerProfile = {
  legal_name: "", legal_form: "", address: "", siret: "", vat_number: "",
  email: "", phone: "", iban: "", payment_terms: "", legal_notice: "",
};

export default function Settings() {
  const [key, setKey] = useState(getGeminiKey());
  const storedModel = getGeminiModel();
  const [modelChoice, setModelChoice] = useState(
    MODEL_OPTIONS.some((o) => o.value === storedModel) ? storedModel : CUSTOM,
  );
  const [customModel, setCustomModel] = useState(
    MODEL_OPTIONS.some((o) => o.value === storedModel) ? "" : storedModel,
  );
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState<IssuerProfile>(emptyProfile);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    supabase.from("issuer_profiles").select("*").maybeSingle().then(({ data }) => {
      if (data) setProfile({ ...emptyProfile, ...data });
    });
  }, []);

  function saveGemini() {
    setGeminiKey(key);
    setGeminiModel(modelChoice === CUSTOM ? customModel : modelChoice);
    setSaved(true);
  }

  function resetGemini() {
    setGeminiKey(""); setKey("");
    setGeminiModel(""); setModelChoice(DEFAULT_GEMINI_MODEL); setCustomModel("");
    setSaved(false);
  }

  async function saveProfile() {
    setProfileMsg(""); setProfileSaved(false);
    if (!profile.legal_name.trim()) return setProfileMsg("La raison sociale / le nom est obligatoire.");
    if (profile.siret && !/^\d{14}$/.test(profile.siret)) return setProfileMsg("Le SIRET doit contenir 14 chiffres.");
    const { error } = await supabase.from("issuer_profiles").upsert({
      ...profile,
      legal_form: profile.legal_form || null,
      address: profile.address || null,
      siret: profile.siret || null,
      vat_number: profile.vat_number || null,
      email: profile.email || null,
      phone: profile.phone || null,
      iban: profile.iban || null,
      payment_terms: profile.payment_terms || null,
      legal_notice: profile.legal_notice || null,
    });
    if (error) return setProfileMsg(error.message);
    setProfileSaved(true);
  }

  const patch = (p: Partial<IssuerProfile>) => { setProfile((pr) => ({ ...pr, ...p })); setProfileSaved(false); };

  return (
    <>
      <h1>Réglages</h1>

      <div className="card">
        <h2>Agents IA (Gemini)</h2>
        <p>
          La clé Gemini est stockée uniquement dans ce navigateur. Elle n'est jamais envoyée à nos
          serveurs ni enregistrée en base.
        </p>
        <label>Clé API Gemini
          <input type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} />
        </label>
        <label>Modèle Gemini
          <select value={modelChoice} onChange={(e) => { setModelChoice(e.target.value); setSaved(false); }}>
            {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value={CUSTOM}>Autre (saisir un identifiant de modèle)</option>
          </select>
        </label>
        {modelChoice === CUSTOM && (
          <label>Identifiant du modèle
            <input value={customModel} onChange={(e) => { setCustomModel(e.target.value); setSaved(false); }} placeholder="gemini-..." />
          </label>
        )}
        <div className="row">
          <button onClick={saveGemini}>Enregistrer</button>
          <button className="secondary" onClick={resetGemini}>Réinitialiser</button>
        </div>
        {saved && <p className="ok">Réglages enregistrés dans ce navigateur.</p>}
      </div>

      <div className="card">
        <h2>Informations légales de l'émetteur</h2>
        <p className="hint">
          Ces informations apparaissent sur vos devis et factures (mentions obligatoires). Elles sont
          figées dans chaque document au moment de son émission : les modifier ici n'affecte pas les
          documents déjà émis.
        </p>
        <div className="row">
          <label>Raison sociale / nom *
            <input value={profile.legal_name} onChange={(e) => patch({ legal_name: e.target.value })} />
          </label>
          <label>Forme juridique
            <input value={profile.legal_form ?? ""} onChange={(e) => patch({ legal_form: e.target.value })} placeholder="EI, EURL, SASU…" />
          </label>
        </div>
        <label>Adresse
          <input value={profile.address ?? ""} onChange={(e) => patch({ address: e.target.value })} />
        </label>
        <div className="row">
          <label>SIRET
            <input value={profile.siret ?? ""} onChange={(e) => patch({ siret: e.target.value })} placeholder="14 chiffres" maxLength={14} />
          </label>
          <label>N° TVA intracommunautaire
            <input value={profile.vat_number ?? ""} onChange={(e) => patch({ vat_number: e.target.value })} placeholder="FR… (vide si non assujetti)" />
          </label>
        </div>
        <div className="row">
          <label>E-mail
            <input type="email" value={profile.email ?? ""} onChange={(e) => patch({ email: e.target.value })} />
          </label>
          <label>Téléphone
            <input value={profile.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })} />
          </label>
        </div>
        <label>IBAN (affiché sur les factures pour le règlement)
          <input value={profile.iban ?? ""} onChange={(e) => patch({ iban: e.target.value })} />
        </label>
        <label>Conditions de paiement
          <input
            value={profile.payment_terms ?? ""}
            onChange={(e) => patch({ payment_terms: e.target.value })}
            placeholder="Paiement à 30 jours à compter de la date d'émission."
          />
        </label>
        <label>Mentions légales complémentaires
          <textarea
            rows={2}
            value={profile.legal_notice ?? ""}
            onChange={(e) => patch({ legal_notice: e.target.value })}
            placeholder="Ex. (B2B) : pénalités de retard au taux légal x3, indemnité forfaitaire de recouvrement de 40 €."
          />
        </label>
        <div className="row">
          <button onClick={saveProfile}>Enregistrer</button>
        </div>
        {profileMsg && <p className="msg">{profileMsg}</p>}
        {profileSaved && <p className="ok">Informations de l'émetteur enregistrées.</p>}
      </div>
    </>
  );
}
