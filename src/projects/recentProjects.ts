const RECENT_PROJECTS_KEY = "openrisk:recent-projects";
const RECENT_PROJECT_LIMIT = 8;

export function readRecentProjects(): string[] {
  try {
    const value = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!value) {
      return [];
    }

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, RECENT_PROJECT_LIMIT);
  } catch {
    return [];
  }
}

export function addRecentProject(projectPath: string): void {
  const next = [
    projectPath,
    ...readRecentProjects().filter((item) => item !== projectPath),
  ].slice(0, RECENT_PROJECT_LIMIT);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
}

export function removeRecentProject(projectPath: string): string[] {
  const next = readRecentProjects().filter((item) => item !== projectPath);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
  return next;
}
