import type { Project } from '../types/project';

export const PROJECTS_STORAGE_KEY = 'facilitate-studio-projects';

export interface ProjectPersistence {
  loadProjects(): Project[];
  saveProjects(projects: Project[]): void;
}

function sortByMostRecentlyUpdated(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function upsertProject(projects: Project[], project: Project): Project[] {
  const existingIndex = projects.findIndex((p) => p.id === project.id);
  const now = new Date().toISOString();

  let updated: Project[];
  if (existingIndex >= 0) {
    updated = [...projects];
    updated[existingIndex] = { ...project, updatedAt: now };
  } else {
    updated = [{ ...project, createdAt: project.createdAt || now, updatedAt: now }, ...projects];
  }

  return sortByMostRecentlyUpdated(updated);
}

export function removeProject(projects: Project[], id: string): Project[] {
  return sortByMostRecentlyUpdated(projects.filter((p) => p.id !== id));
}

export class LocalStorageProjectPersistence implements ProjectPersistence {
  loadProjects(): Project[] {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Project[];
    return sortByMostRecentlyUpdated(parsed);
  }

  saveProjects(projects: Project[]): void {
    // Let errors bubble so callers can present a UI.
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }
}
