import React, { useState } from 'react';
import { NavItem, NavSection } from '../../types/navigation';
import { Icon } from '../Icon';
import { useLocation, useNavigate } from 'react-router-dom';
import { ModulesDrawer } from './ModulesDrawer';

interface BottomNavBarProps {
  bottomNav: NavItem[];
  sections: NavSection[];
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ bottomNav, sections }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (item: NavItem) => {
    const path = location.pathname;
    const target = item.path ?? `/${item.code}`;
    return path.startsWith(target);
  };
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 border-t border-slate-800/70 backdrop-blur-xl px-3 py-2">
        <div className="flex items-center justify-between">
          {bottomNav.map((item) => {
            const isMore = item.code === 'more';
            const active = isActive(item);
            return (
              <button
                key={item.code}
                onClick={() => (isMore ? setOpen(true) : navigate(item.path ?? `/${item.code}.list`))}
                className="flex flex-col items-center flex-1 gap-0.5"
              >
                <span
                  className={[
                    'h-9 w-9 rounded-2xl flex items-center justify-center transition',
                    active ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:bg-slate-900',
                  ].join(' ')}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="text-[11px] text-slate-300">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <ModulesDrawer open={open} onClose={() => setOpen(false)} sections={sections} />
    </>
  );
};
