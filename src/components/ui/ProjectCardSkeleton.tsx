interface ProjectCardSkeletonProps {
  count?: number;
}

export function ProjectCardSkeleton({ count = 3 }: ProjectCardSkeletonProps): JSX.Element {
  const placeholders = Array.from({ length: count }, (_, index) => `project-skeleton-${index}`);

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-live="polite"
      aria-label="Loading projects"
    >
      {placeholders.map((key) => (
        <div
          key={key}
          className="overflow-hidden rounded-[20px] border border-white/55 bg-white/70 shadow-glass-sm backdrop-blur-sm"
        >
          <div className="aspect-video animate-pulse bg-slate-200/70" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200/80" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
