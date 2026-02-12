import { CloudUpload, Loader2 } from 'lucide-react';
import { Button } from './Button';
import type { MigrationSummary } from '../hooks/useLocalProjectMigration';

interface LocalProjectMigrationProps {
  projectCount: number;
  isImporting: boolean;
  progress: {
    current: number;
    total: number;
  };
  importError: string | null;
  migrationSummary: MigrationSummary | null;
  onImport: () => void;
  onDismiss: () => void;
}

/**
 * Banner that prompts signed-in users to import local projects to cloud storage.
 */
export function LocalProjectMigration({
  projectCount,
  isImporting,
  progress,
  importError,
  migrationSummary,
  onImport,
  onDismiss,
}: LocalProjectMigrationProps): JSX.Element {
  const hasFailures = (migrationSummary?.failed ?? 0) > 0;
  const hasSuccess = (migrationSummary?.imported ?? 0) > 0;

  return (
    <div className="mb-5 rounded-[20px] border border-blue-200/70 bg-blue-50/80 px-4 py-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-700">
            <CloudUpload size={16} aria-hidden="true" />
            <h3 className="text-sm font-semibold">Import local projects to your account</h3>
          </div>
          <p className="mt-1 text-sm text-blue-900/90">
            We found {projectCount} project{projectCount === 1 ? '' : 's'} saved on this device.
          </p>
          <p className="mt-1 text-xs text-blue-800/80">
            Importing keeps your projects available across devices. Starter assets stay app-bundled.
          </p>

          {isImporting ? (
            <p className="mt-2 text-xs font-medium text-blue-800">
              Importing project {progress.current} of {progress.total}...
            </p>
          ) : null}

          {migrationSummary ? (
            <p
              className={`mt-2 text-xs font-medium ${
                hasFailures ? 'text-amber-800' : 'text-emerald-700'
              }`}
            >
              Imported {migrationSummary.imported} project{migrationSummary.imported === 1 ? '' : 's'}
              {hasFailures ? `, ${migrationSummary.failed} failed.` : '.'}
            </p>
          ) : null}

          {hasSuccess && !hasFailures ? (
            <p className="mt-1 text-xs text-emerald-700">Your account now has the latest imported projects.</p>
          ) : null}

          {importError ? <p className="mt-1 text-xs text-amber-800">{importError}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onImport}
            disabled={isImporting}
            className="rounded-[14px] px-3 py-1.5 text-xs"
          >
            {isImporting ? (
              <>
                <Loader2 size={12} className="mr-1.5 animate-spin" aria-hidden="true" />
                Importing...
              </>
            ) : (
              'Import now'
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            disabled={isImporting}
            className="rounded-[14px] px-3 py-1.5 text-xs"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
