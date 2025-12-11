import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Table2, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { modulesService, ModuleItem } from '../services/modules.service';

export const DashboardLayout = () => {
  const { auth, logout } = useAuth();
  const user = auth.user;
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [dynamicModules, setDynamicModules] = useState<ModuleItem[]>([]);

  useEffect(() => {
    modulesService
      .list()
      .then((mods) => setDynamicModules(mods))
      .catch(() => setDynamicModules([]));
  }, []);

  const displayName = user?.displayName || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navItem = (item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }) => {
    const isActive = location.pathname === item.href;
    return (
      <Link
        key={item.name}
        to={item.href}
        className={clsx(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-105'
            : 'text-slate-700 hover:bg-white/80 hover:shadow-md hover:scale-105',
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <item.icon
          className={clsx(
            'h-5 w-5 transition-all duration-200',
            isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-600',
          )}
        />
        <span
          className={clsx(
            'transition-all duration-300 overflow-hidden whitespace-nowrap',
            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
          )}
        >
          {item.name}
        </span>
        {isActive && !isCollapsed && <div className="absolute right-2 h-2 w-2 rounded-full bg-white animate-pulse" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col">
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-8 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center text-base font-bold shadow-lg shadow-blue-500/30">
            HW
          </div>
          <div>
            <div className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              HubbleWave
            </div>
            <div className="text-xs text-slate-500 font-medium">Envision At Your Own Ease</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm font-semibold text-slate-700">
          <button className="hover:text-blue-600 transition-colors">Docs</button>
          <button className="hover:text-blue-600 transition-colors">Support</button>
          <button className="hover:text-blue-600 transition-colors">Status</button>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-500/30 ring-2 ring-blue-200">
            {initials || 'U'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={clsx(
            'fixed lg:relative z-30 inset-y-0 left-0 bg-white/60 backdrop-blur-2xl border-r border-slate-200/60 shadow-2xl transform transition-all duration-300 ease-in-out',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            isCollapsed ? 'lg:w-20' : 'lg:w-72',
            'w-72',
          )}
        >
          <div className="h-full flex flex-col relative">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={clsx(
                'hidden lg:flex absolute -right-3 top-6 z-50 h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110',
                'ring-2 ring-white',
              )}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>

            <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
              <div>
                <p
                  className={clsx(
                    'text-xs uppercase text-slate-500 font-bold mb-3 transition-all duration-300',
                    isCollapsed ? 'opacity-0 h-0' : 'opacity-100 h-auto',
                  )}
                >
                  Navigation
                </p>
                <div className="space-y-1.5">
                  {dynamicModules.length === 0 && !isCollapsed && (
                    <div className="text-slate-500 text-sm bg-slate-50 rounded-lg p-3 border border-slate-200">
                      Loading modules...
                    </div>
                  )}
                  {dynamicModules.map((m) =>
                    navItem({
                      name: m.name,
                      href: m.route || `/modules/${m.slug}`,
                      icon: Table2,
                    }),
                  )}
                </div>
              </div>
            </div>

            <div
              className={clsx(
                'px-4 pb-6 space-y-3 transition-all duration-300',
              )}
            >
              {!isCollapsed && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-slate-800 text-sm border border-blue-200/50 shadow-sm">
                  <p className="font-bold mb-1">Need help?</p>
                  <p className="text-xs text-slate-600 mb-2">Refine filters or export asset lists with our team.</p>
                  <button className="text-blue-700 font-bold text-sm hover:underline">Talk to specialist</button>
                </div>
              )}
              <button
                onClick={logout}
                className={clsx(
                  'w-full text-left rounded-xl text-sm font-semibold text-slate-700 hover:bg-red-50 border-2 border-slate-200 bg-white hover:border-red-200 transition-all duration-200 hover:shadow-md',
                  isCollapsed ? 'px-3 py-2 flex items-center justify-center' : 'px-4 py-2.5',
                )}
                title={isCollapsed ? 'Sign out' : undefined}
              >
                {isCollapsed ? '⎋' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
          <footer className="flex justify-end gap-6 px-6 pb-6 text-sm text-slate-500">
            <button className="hover:text-blue-600 transition-colors">Privacy</button>
            <button className="hover:text-blue-600 transition-colors">Terms</button>
            <button className="hover:text-blue-600 transition-colors">Support</button>
          </footer>
        </div>
      </div>
    </div>
  );
};
