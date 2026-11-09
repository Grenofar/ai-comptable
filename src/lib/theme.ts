// Thème sombre par défaut, avec bascule claire mémorisée dans ce navigateur.
export type Theme = "dark" | "light";
const KEY = "ai-comptable:theme";

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme); } catch { /* stockage indisponible */ }
  applyTheme(theme);
}

// Appelé au tout premier rendu pour éviter un flash de thème clair.
applyTheme(getTheme());
