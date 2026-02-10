import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SidebarSection } from '../../types';

export interface NavItemProps {
  id: SidebarSection;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

export const NavItem = memo<NavItemProps>(({ icon: Icon, label, isActive, onClick, compact = false }) => {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`
        group relative flex w-full flex-col items-center justify-center rounded-[20px] transition-all duration-300
        ${compact ? 'gap-0 p-2' : 'gap-1.5 p-3'}
        ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
            : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
        }
      `}
    >
      <Icon
        size={compact ? 20 : 22}
        strokeWidth={isActive ? 2.5 : 2}
        className="transition-transform duration-300 group-hover:scale-110"
      />
      {!compact && <span className="text-xs font-semibold tracking-tight">{label}</span>}
    </button>
  );
});
NavItem.displayName = 'NavItem';

