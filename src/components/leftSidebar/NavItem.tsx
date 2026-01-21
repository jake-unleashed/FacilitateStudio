import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SidebarSection } from '../../types';

export interface NavItemProps {
  id: SidebarSection;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const NavItem = memo<NavItemProps>(({ icon: Icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex w-full flex-col items-center justify-center gap-1.5 rounded-[20px] p-3 transition-all duration-300
        ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20'
            : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
        }
      `}
    >
      <Icon
        size={22}
        strokeWidth={isActive ? 2.5 : 2}
        className="transition-transform duration-300 group-hover:scale-110"
      />
      <span className="text-xs font-semibold tracking-tight">{label}</span>
    </button>
  );
});
NavItem.displayName = 'NavItem';

