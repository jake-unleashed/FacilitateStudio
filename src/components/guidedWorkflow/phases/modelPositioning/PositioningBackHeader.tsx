import { ArrowLeft } from 'lucide-react';

export interface PositioningBackHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  backButtonLabel: string;
}

export function PositioningBackHeader({
  title,
  subtitle,
  onBack,
  backButtonLabel,
}: PositioningBackHeaderProps): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/40 bg-white/60 text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/80 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        aria-label={backButtonLabel}
      >
        <ArrowLeft size={16} />
      </button>
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-slate-800">{title}</h2>
        <p className="text-sm font-medium text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}

