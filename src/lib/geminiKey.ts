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
