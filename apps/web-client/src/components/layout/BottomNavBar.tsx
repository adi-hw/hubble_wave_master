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
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-xl px-3 py-2 safe-area-pb">
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
                    active
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <span className={`text-[11px] ${active ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <ModulesDrawer open={open} onClose={() => setOpen(false)} sections={sections} />
    </>
  );
};
