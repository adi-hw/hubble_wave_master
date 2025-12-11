import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavSection } from '../../types/navigation';
import { Icon } from '../Icon';
import { deriveTenantSlug } from '../../services/token';

interface SidebarDockProps {
  sections: NavSection[];
}

export const SidebarDock: React.FC<SidebarDockProps> = ({ sections }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tenantSlug = deriveTenantSlug(window.location.hostname) || 'default';

  const primaryItems = sections.flatMap((section) => section.items).slice(0, 5);
  const activeCode = location.pathname.split('/')[4]; // /:tenant/ui/modules/{code}

  return (
    <aside className="hidden md:flex flex-col justify-between py-4 px-2 w-[4.5rem] bg-slate-900/70 border-r border-slate-800/80 backdrop-blur-2xl">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-sky-500/90 flex items-center justify-center text-white font-semibold shadow-lg shadow-sky-500/40">
          HW
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {primaryItems.map((item) => {
            const isActive = activeCode === item.code;
            return (
              <button
                key={item.code}
                onClick={() => navigate(`/${tenantSlug}/ui/modules/${item.code}`)}
                className={[
                  'relative flex items-center justify-center h-11 w-11 rounded-2xl transition',
                  isActive
                    ? 'bg-sky-500/20 border border-sky-400/60 shadow shadow-sky-500/40'
                    : 'bg-slate-900/80 border border-slate-700/70 hover:bg-slate-800',
                ].join(' ')}
              >
                {isActive && <span className="absolute -left-1 h-7 w-0.5 rounded-full bg-sky-400" />}
                <Icon name={item.icon} className={`h-5 w-5 ${isActive ? 'text-sky-300' : 'text-slate-400'}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-200">
          AS
        </button>
        <button className="h-9 w-9 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
          <Icon name="Settings" className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </aside>
  );
};
