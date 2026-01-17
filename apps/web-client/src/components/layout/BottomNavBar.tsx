import React, { useState } from 'react';
import { NavItem, NavSection } from '../../types/navigation';
import { Icon } from '../Icon';
import { useLocation, useNavigate } from 'react-router-dom';
import { ModulesDrawer } from './ModulesDrawer';

interface BottomNavBarProps {
  bottomNav: NavItem[];
  sections: NavSection[];
  onOpenSearch?: () => void;
  onOpenAva?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  bottomNav,
  sections,
  onOpenSearch,
  onOpenAva,
}) => {
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
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-card/95 border-t border-border h-14 px-3 py-2 pb-safe"
      >
        <div className="flex items-center justify-between">
          {bottomNav.map((item) => {
            const isMore = item.code === 'more';
            const isSearch = item.code === 'search';
            const isAva = item.code === 'ava';
            const active = isActive(item);
            return (
              <button
                key={item.code}
                onClick={() => {
                  if (isMore) {
                    setOpen(true);
                  } else if (isSearch && onOpenSearch) {
                    onOpenSearch();
                  } else if (isAva && onOpenAva) {
                    onOpenAva();
                  } else {
                    navigate(item.path ?? `/${item.code}.list`);
                  }
                }}
                className="flex flex-col items-center flex-1 gap-0.5"
              >
                <span
                  className={`h-9 w-9 rounded-2xl flex items-center justify-center transition ${
                    active ? 'bg-primary/10 text-primary' : 'bg-transparent text-muted-foreground'
                  }`}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <span
                  className={`text-[11px] ${
                    active ? 'text-primary font-medium' : 'text-muted-foreground font-normal'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <ModulesDrawer open={open} onClose={() => setOpen(false)} sections={sections} />
    </>
  );
};
