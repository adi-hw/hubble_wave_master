import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from '../auth/useProfile';
import { LogOut, Settings, User, ChevronDown, Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export const AppHeader: React.FC = () => {
  const { auth } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const user = auth.user;
  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';

  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 shadow-sm">
      {/* Logo & Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hubble-gradient text-xs font-bold text-white shadow-sm">
          HW
        </div>
        <div className="hidden sm:block">
          <span className="text-base font-semibold text-slate-900 dark:text-white">HubbleWave</span>
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">EAM Platform</span>
        </div>
      </div>

      {/* Search Bar - Optional, hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="search"
            placeholder="Search..."
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-400 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2">
        {/* Admin Badges */}
        {user?.isPlatformAdmin && (
          <span className="hidden sm:inline-flex badge-primary">
            Platform Admin
          </span>
        )}
        {!user?.isPlatformAdmin && user?.isTenantAdmin && (
          <span className="hidden sm:inline-flex badge-neutral">
            Tenant Admin
          </span>
        )}

        {/* Theme Toggle */}
        <ThemeToggle variant="dropdown" size="md" />

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary-500" />
        </button>

        {/* User Menu */}
        <UserMenu
          initials={initials}
          name={displayName}
          email={user?.email}
          onNavigate={navigate}
        />
      </div>
    </header>
  );
};

const UserMenu: React.FC<{
  initials: string;
  name: string;
  email?: string;
  onNavigate: (path: string) => void;
}> = ({ initials, name, email, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await authService.logout();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hubble-gradient text-xs font-semibold text-white shadow-sm">
          {initials}
        </div>
        <div className="hidden lg:flex flex-col text-left">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">{name}</span>
          {email && (
            <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{email}</span>
          )}
        </div>
        <ChevronDown className={`hidden lg:block h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-elevated py-1 animate-fade-in">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{name}</p>
            {email && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{email}</p>}
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/settings/profile');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Your Profile
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Settings
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
