import { useCallback, useEffect, useMemo, useState } from 'react';
import { createProjectPersistence, createSupabasePersistence } from '../persistence/projectPersistence';
import type { Project } from '../types/project';

const MIGRATION_DISMISSED_KEY = 'migration-prompt-dismissed';

interface ImportProgressState {
  current: number;
  total: number;
}

export interface MigrationSummary {
  imported: number;
  failed: number;
  failedProjectNames: string[];
}

export interface UseLocalProjectMigrationOptions {
  userId: string | null | undefined;
  isProjectsLoading: boolean;
  saveProject: (project: Project) => Promise<void>;
}

export interface UseLocalProjectMigrationResult {
  showMigrationPrompt: boolean;
  localOnlyProjects: Project[];
  importProgress: ImportProgressState;
  isImporting: boolean;
  importError: string | null;
  migrationSummary: MigrationSummary | null;
  dismiss: () => void;
  importAll: () => Promise<void>;
}

/**
 * Detects local-only projects for signed-in users and provides a migration action.
 */
export function useLocalProjectMigration({
  userId,
  isProjectsLoading,
  saveProject,
}: UseLocalProjectMigrationOptions): UseLocalProjectMigrationResult {
  const [localOnlyProjects, setLocalOnlyProjects] = useState<Project[]>([]);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem(MIGRATION_DISMISSED_KEY) === 'true';
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgressState>({ current: 0, total: 0 });
  const [importError, setImportError] = useState<string | null>(null);
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!userId || isProjectsLoading) {
      return;
    }

    let cancelled = false;
    const localPersistence = createProjectPersistence();
    const cloudPersistence = createSupabasePersistence();

    const detectLocalOnlyProjects = async (): Promise<void> => {
      try {
        const [localProjects, cloudProjects] = await Promise.all([
          localPersistence.loadProjects(),
          cloudPersistence.loadProjects(),
        ]);
        if (cancelled) {
          return;
        }

        const cloudIds = new Set(cloudProjects.map((project) => project.id));
        const localOnly = localProjects.filter((project) => !cloudIds.has(project.id));
        setLocalOnlyProjects(localOnly);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.warn('[useLocalProjectMigration] Failed to detect local-only projects:', error);
        setLocalOnlyProjects([]);
      }
    };

    void detectLocalOnlyProjects();

    return () => {
      cancelled = true;
    };
  }, [userId, isProjectsLoading, refreshCounter]);

  const dismiss = useCallback(() => {
    localStorage.setItem(MIGRATION_DISMISSED_KEY, 'true');
    setIsDismissed(true);
  }, []);

  const importAll = useCallback(async () => {
    if (!userId || localOnlyProjects.length === 0 || isImporting) {
      return;
    }

    setImportError(null);
    setMigrationSummary(null);
    setIsImporting(true);
    setImportProgress({ current: 0, total: localOnlyProjects.length });

    let imported = 0;
    const failedProjectNames: string[] = [];

    for (let index = 0; index < localOnlyProjects.length; index += 1) {
      const project = localOnlyProjects[index];
      try {
        await saveProject(project);
        imported += 1;
      } catch (error) {
        console.warn(`[useLocalProjectMigration] Failed to import project ${project.id}:`, error);
        failedProjectNames.push(project.name);
      } finally {
        setImportProgress({ current: index + 1, total: localOnlyProjects.length });
      }
    }

    setMigrationSummary({
      imported,
      failed: failedProjectNames.length,
      failedProjectNames,
    });

    if (failedProjectNames.length > 0) {
      setImportError('Some projects could not be imported. You can retry to import the remaining projects.');
    }

    setIsImporting(false);
    setRefreshCounter((current) => current + 1);
  }, [userId, localOnlyProjects, isImporting, saveProject]);

  const showMigrationPrompt = useMemo(() => {
    if (!userId || isDismissed || isProjectsLoading || isImporting) {
      return false;
    }
    return localOnlyProjects.length > 0;
  }, [isDismissed, isImporting, isProjectsLoading, localOnlyProjects.length, userId]);

  return {
    showMigrationPrompt,
    localOnlyProjects,
    importProgress,
    isImporting,
    importError,
    migrationSummary,
    dismiss,
    importAll,
  };
}
