import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Project } from '../types/project';

export const PROJECTS_STORAGE_KEY = 'facilitate-studio-projects';
const PROJECTS_DB_NAME = 'facilitate-studio-projects-db';
const PROJECTS_DB_VERSION = 1;
const MIGRATION_COMPLETE_KEY = 'facilitate-studio-projects-indexeddb-migration-complete';

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Sync persistence interface (legacy localStorage).
 */
export interface ProjectPersistence {
  loadProjects(): Project[];
  saveProjects(projects: Project[]): void;
}

/**
 * Async persistence interface for IndexedDB.
 */
export interface AsyncProjectPersistence {
  /** Load all projects from storage */
  loadProjects(): Promise<Project[]>;
  /** Save all projects to storage (replaces existing) */
  saveProjects(projects: Project[]): Promise<void>;
  /** Get a single project by ID */
  getProject(id: string): Promise<Project | undefined>;
  /** Save or update a single project */
  saveProject(project: Project): Promise<void>;
  /** Delete a project by ID */
  deleteProject(id: string): Promise<void>;
}

// =============================================================================
// IndexedDB Schema
// =============================================================================

interface ProjectStoreDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': string };
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sort projects by most recently updated first.
 * @param projects - Array of projects to sort
 * @returns New array sorted by updatedAt descending
 */
function sortByMostRecentlyUpdated(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Insert or update a project in an array.
 * Updates existing project if ID matches, otherwise prepends new project.
 * @param projects - Current array of projects
 * @param project - Project to insert or update
 * @returns New sorted array with the project added/updated
 */
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

/**
 * Remove a project from an array by ID.
 * @param projects - Current array of projects
 * @param id - ID of project to remove
 * @returns New sorted array with the project removed
 */
export function removeProject(projects: Project[], id: string): Project[] {
  return sortByMostRecentlyUpdated(projects.filter((p) => p.id !== id));
}

// =============================================================================
// IndexedDB Database Connection (Singleton)
// =============================================================================

let dbInstance: IDBPDatabase<ProjectStoreDB> | null = null;
let dbPromise: Promise<IDBPDatabase<ProjectStoreDB>> | null = null;

/**
 * Get or create the database connection.
 * Uses a singleton pattern to prevent multiple connections.
 * @returns Promise resolving to the IndexedDB database instance
 * @throws Error if IndexedDB is not available or database creation fails
 */
async function getDB(): Promise<IDBPDatabase<ProjectStoreDB>> {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = openDB<ProjectStoreDB>(PROJECTS_DB_NAME, PROJECTS_DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    })
      .then((db) => {
        dbInstance = db;
        return db;
      })
      .catch((error) => {
        // Reset promise so next call can retry
        dbPromise = null;
        throw error;
      });
  }

  return dbPromise;
}

// =============================================================================
// Migration from localStorage
// =============================================================================

/**
 * Check if there are projects in localStorage that need migration.
 */
function hasLegacyProjects(): boolean {
  if (localStorage.getItem(MIGRATION_COMPLETE_KEY)) {
    return false;
  }
  const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (!stored) return false;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrate projects from localStorage to IndexedDB.
 * @returns Number of successfully migrated projects
 */
async function migrateLegacyProjects(): Promise<number> {
  if (!hasLegacyProjects()) {
    // Mark as complete even if no projects to migrate
    localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
    return 0;
  }

  const db = await getDB();
  let migratedCount = 0;

  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!stored) return 0;

    const projects: Project[] = JSON.parse(stored);

    for (const project of projects) {
      try {
        await db.put('projects', project);
        migratedCount++;
      } catch (error) {
        console.error(`[projectPersistence] Failed to migrate project ${project.id}:`, error);
      }
    }

    // Clear localStorage after successful migration
    if (migratedCount === projects.length) {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
    }

    localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
    console.log(
      `[projectPersistence] Migrated ${migratedCount}/${projects.length} projects to IndexedDB`
    );

    return migratedCount;
  } catch (error) {
    console.error('[projectPersistence] Migration failed:', error);
    return migratedCount;
  }
}

// =============================================================================
// IndexedDB Project Persistence
// =============================================================================

/**
 * IndexedDB-based project persistence with GB-scale storage.
 * Replaces localStorage to avoid quota limits.
 */
export class IndexedDBProjectPersistence implements AsyncProjectPersistence {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database and run migration if needed.
   * Called automatically on first operation, but can be called explicitly.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        await getDB();
        await migrateLegacyProjects();
        this.initialized = true;
      })();
    }

    return this.initPromise;
  }

  /**
   * Load all projects from IndexedDB.
   */
  async loadProjects(): Promise<Project[]> {
    await this.initialize();
    const db = await getDB();
    const projects = await db.getAll('projects');
    return sortByMostRecentlyUpdated(projects);
  }

  /**
   * Save all projects to IndexedDB.
   * Uses a transaction to ensure atomicity.
   */
  async saveProjects(projects: Project[]): Promise<void> {
    await this.initialize();
    const db = await getDB();

    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');

    // Clear existing and add all projects
    await store.clear();
    for (const project of projects) {
      await store.put(project);
    }

    await tx.done;
  }

  /**
   * Get a single project by ID.
   */
  async getProject(id: string): Promise<Project | undefined> {
    await this.initialize();
    const db = await getDB();
    return db.get('projects', id);
  }

  /**
   * Save or update a single project.
   */
  async saveProject(project: Project): Promise<void> {
    await this.initialize();
    const db = await getDB();
    const now = new Date().toISOString();
    const updated = {
      ...project,
      updatedAt: now,
      createdAt: project.createdAt || now,
    };
    await db.put('projects', updated);
  }

  /**
   * Delete a project by ID.
   */
  async deleteProject(id: string): Promise<void> {
    await this.initialize();
    const db = await getDB();
    await db.delete('projects', id);
  }
}

// =============================================================================
// Legacy localStorage Persistence (kept for reference/fallback)
// =============================================================================

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

// =============================================================================
// Default Export
// =============================================================================

/**
 * Create the default project persistence instance.
 * Uses IndexedDB for GB-scale storage.
 */
export function createProjectPersistence(): IndexedDBProjectPersistence {
  return new IndexedDBProjectPersistence();
}
