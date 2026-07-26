const THEME_CLASSES = ["light", "dark"] as const;

export function applyTheme(theme: string): void {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);

  if (theme === "light" || theme === "dark") {
    root.classList.add(theme);
    return;
  }

  root.classList.add(
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
}
