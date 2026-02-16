import { ReactNode } from 'react';
import { PublishedSurface } from './PublishedSurface';

interface PublishedCenterCardProps {
  title: string;
  description: string;
  eyebrow?: string;
  footer?: ReactNode;
}

export function PublishedCenterCard({
  title,
  description,
  eyebrow,
  footer,
}: PublishedCenterCardProps): JSX.Element {
  return (
    <PublishedSurface>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[20px] border border-white/50 bg-white/80 p-7 text-center shadow-glass backdrop-blur-xl sm:p-8">
          {eyebrow ? (
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{eyebrow}</p>
          ) : null}
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
          <p className="mx-auto max-w-sm text-sm font-medium text-slate-600">{description}</p>
        </div>
      </div>
      {footer ? (
        <div className="pb-5 text-center text-xs font-medium text-slate-400 sm:pb-6">{footer}</div>
      ) : null}
    </PublishedSurface>
  );
}

