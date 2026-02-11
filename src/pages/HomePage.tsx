import { memo, useCallback } from 'react';
import { Plus, Clock, Layers, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useProjects } from '../hooks/useProjects';
import { ProjectMetadata } from '../types/project';
import { formatRelativeDate } from '../utils/formatRelativeDate';
import { useRouteTransition } from '../contexts/RouteTransitionContext';

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Facilitate Studio branding for the home page hero section.
 *
 * Uses a slate-at-rest appearance with color reveal on hover to establish
 * clear visual hierarchy where the CTA button is the primary focal point.
 */
interface HomeBrandingProps {
  /**
   * Enables the hover color-reveal effect for the home page branding.
   *
   * This is intentionally opt-in so the home page can keep a stable, non-interactive
   * brand mark (while the editor's top-left logo can remain interactive).
   */
  enableHover?: boolean;
}

const HomeBranding = memo(function HomeBranding({ enableHover = false }: HomeBrandingProps) {
  return (
    <div className={`${enableHover ? 'group ' : ''}flex select-none flex-col items-center`}>
      <div className="relative">
        {/* Glow layer - fades in on hover */}
        <div
          className="absolute inset-0 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden="true"
        >
          <span className="text-4xl font-black tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent opacity-40">
              Facilitate
            </span>
          </span>
        </div>

        {/* Main text with overlay technique */}
        <h1 className="relative text-4xl font-black tracking-tight sm:text-5xl">
          {/* Gradient layer underneath */}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent [backface-visibility:hidden]">
            Facilitate
          </span>
          {/* Slate overlay - fades out on hover to reveal gradient */}
          <span
            className="pointer-events-none absolute inset-0 text-slate-700 transition-opacity duration-500 ease-in-out will-change-[opacity] [backface-visibility:hidden] group-hover:opacity-0"
            aria-hidden="true"
          >
            Facilitate
          </span>
        </h1>
      </div>

      {/* Studio subtitle - color transition on hover */}
      <span className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-slate-400 transition-colors duration-500 group-hover:text-blue-500 sm:text-sm">
        Studio
      </span>
    </div>
  );
});

/**
 * Props for the ProjectCard component.
 */
interface ProjectCardProps {
  /** Project metadata to display */
  project: ProjectMetadata;
  /** Callback when the card is clicked to open the project */
  onOpen: (id: string) => void;
  /** Callback when the delete button is clicked */
  onDelete: (id: string) => void;
}

/**
 * Interactive project card with thumbnail, title, and timestamp.
 *
 * Features hover effects and a delete button that appears on hover.
 */
const ProjectCard = memo(function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const handleClick = useCallback(() => {
    onOpen(project.id);
  }, [onOpen, project.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete(project.id);
    },
    [onDelete, project.id]
  );

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className="group relative flex cursor-pointer flex-col rounded-[20px] border border-white/60 bg-white/70 p-4 text-left shadow-glass-sm backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-blue-200/50 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
    >
      {/* Thumbnail */}
      <div className="relative mb-3 flex aspect-video w-full items-center justify-center overflow-hidden rounded-[12px] border border-white/60 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 shadow-inner">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={`${project.name} preview`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <>
            {/* Decorative gradient mesh */}
            <div className="absolute inset-0 opacity-30" aria-hidden="true">
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-blue-400/40 blur-2xl" />
              <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-indigo-400/30 blur-2xl" />
            </div>
            <Layers
              size={28}
              className="relative text-slate-300 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-400"
              aria-hidden="true"
            />
          </>
        )}
      </div>

      {/* Project info */}
      <h3 className="truncate text-sm font-bold text-slate-700 transition-colors group-hover:text-slate-900">
        {project.name}
      </h3>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Clock size={10} aria-hidden="true" />
        <time dateTime={project.updatedAt}>{formatRelativeDate(project.updatedAt)}</time>
      </div>

      {/* Delete button - appears on hover */}
      <button
        type="button"
        className="absolute right-2 top-2 rounded-[12px] border border-white/60 bg-white/90 p-1.5 text-slate-400 opacity-0 shadow-sm transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        onClick={handleDelete}
        aria-label={`Delete project ${project.name}`}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
});

/**
 * Empty state shown when there are no recent projects.
 */
const EmptyState = memo(function EmptyState() {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[32px] border border-white/40 bg-white/50 py-16 text-center shadow-glass-sm backdrop-blur-sm">
      {/* Decorative gradient orbs */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Icon container */}
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/60 bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm">
        <Layers size={36} className="text-slate-300" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-slate-600">No recent projects</h3>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        Create your first simulation to get started building immersive training experiences
      </p>
    </div>
  );
});

/**
 * Section header with icon, title, and decorative divider line.
 */
interface SectionHeaderProps {
  /** Icon component to display */
  icon: React.ReactNode;
  /** Section title text */
  title: string;
}

const SectionHeader = memo(function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      </div>
      <div
        className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
});

// =============================================================================
// Main Component
// =============================================================================

/**
 * HomePage - Landing page and project library for Facilitate Studio.
 *
 * Features:
 * - Gradient background with decorative orbs
 * - Interactive branding with hover color reveal
 * - Grid of recent project cards
 * - Empty state for new users
 */
export function HomePage(): JSX.Element {
  const { transitionTo } = useRouteTransition();
  const { getProjectMetadata, deleteProject, isLoading } = useProjects();
  const recentProjects = getProjectMetadata();

  const handleCreateNew = useCallback(() => {
    void transitionTo('/editor');
  }, [transitionTo]);

  const handleOpenProject = useCallback(
    (id: string) => {
      void transitionTo(`/editor/${id}`);
    },
    [transitionTo]
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      deleteProject(id);
    },
    [deleteProject]
  );

  return (
    <div className="relative min-h-screen w-full bg-slate-100 selection:bg-blue-500/30 selection:text-white">
      {/* Fixed background layers */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#e2e8f0_50%,_#cbd5e1_100%)]"
        aria-hidden="true"
      />

      {/* Decorative gradient orbs */}
      <div
        className="pointer-events-none fixed -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-400/15 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-purple-400/10 blur-[80px]"
        aria-hidden="true"
      />

      {/* Main content */}
      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
        {/* Hero section */}
        <section className="flex flex-col items-center">
          <HomeBranding enableHover={false} />

          <p className="mt-8 text-center text-sm leading-relaxed text-slate-400">
            Create immersive training simulations for your team
          </p>

          <Button
            variant="primary"
            size="lg"
            onClick={handleCreateNew}
            className="group mt-10 gap-2.5 rounded-[20px] px-8 py-4 text-base shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40"
          >
            <Plus
              size={20}
              strokeWidth={2.5}
              className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110"
              aria-hidden="true"
            />
            Create New Project
          </Button>
        </section>

        {/* Recent Projects Section */}
        <section className="mt-20">
          <SectionHeader
            icon={<Clock size={14} className="text-slate-400" aria-hidden="true" />}
            title="Recent"
          />

          {isLoading ? (
            <div
              className="flex items-center justify-center py-16"
              role="status"
              aria-label="Loading projects"
            >
              <div className="text-sm text-slate-400">Loading...</div>
            </div>
          ) : recentProjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={handleOpenProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
