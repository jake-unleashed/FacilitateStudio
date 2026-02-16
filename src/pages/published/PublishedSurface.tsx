import { ReactNode } from 'react';

const SURFACE_BACKGROUND_CLASSES =
  'bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#e2e8f0_50%,_#cbd5e1_100%)]';

interface PublishedSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function PublishedSurface({ children, className = '' }: PublishedSurfaceProps): JSX.Element {
  return (
    <div className={`fixed inset-0 ${SURFACE_BACKGROUND_CLASSES} ${className}`}>
      <div className="absolute inset-0 bg-white/20" aria-hidden="true" />
      <div className="relative z-10 flex h-full w-full flex-col">{children}</div>
    </div>
  );
}

