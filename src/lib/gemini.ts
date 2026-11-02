import { getGeminiKey, getGeminiModel } from "./geminiKey";

// Appel direct depuis le navigateur avec la clé de l'utilisateur.
// La clé n'est jamais journalisée ni envoyée ailleurs qu'à l'API Gemini.
export async function askGeminiJson(prompt: string): Promise<unknown> {
  const key = getGeminiKey();
  if (!key) throw new Error("Clé Gemini manquante. Ajoutez-la dans Réglages.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(getGeminiModel())}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    },
  );

  if (res.status === 404) {
    throw new Error("Modèle Gemini introuvable ou retiré. Changez le modèle dans Réglages.");
  }
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 403
        ? "Clé Gemini refusée. Vérifiez-la dans Réglages."
        : `Erreur Gemini (${res.status}).`,
    );
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse Gemini vide.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Réponse Gemini illisible.");
  }
}
