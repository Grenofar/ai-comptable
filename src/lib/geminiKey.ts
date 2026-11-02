// La clé Gemini reste dans le navigateur (localStorage). Jamais envoyée au backend,
// jamais stockée dans Supabase, jamais journalisée.
const KEY = "ai-comptable:gemini-key";

export function getGeminiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setGeminiKey(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(KEY, value.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}

// Nom du modèle, modifiable dans Réglages : les modèles Gemini sont régulièrement retirés.
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const MODEL_KEY = "ai-comptable:gemini-model";

export function getGeminiModel(): string {
  try {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function setGeminiModel(value: string): void {
  try {
    const v = value.trim();
    if (v && v !== DEFAULT_GEMINI_MODEL) localStorage.setItem(MODEL_KEY, v);
    else localStorage.removeItem(MODEL_KEY);
  } catch {
    /* stockage indisponible */
  }
}