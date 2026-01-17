
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from '../auth/useProfile';
import { LogOut, User, ChevronDown, Bell, Search, Palette, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

export const AppHeader: React.FC = () => {
  const { auth } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const user = auth.user;
  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';

  const initials = displayName
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 bg-card border-b border-border shadow-sm">
      {/* Logo & Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground shadow-sm bg-gradient-to-br from-primary to-primary/80">
          HW
        </div>
        <div className="hidden sm:block">
          <span className="text-base font-semibold text-foreground">
            HubbleWave
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            Envision at your own ease
          </span>
        </div>
      </div>

      {/* Search Bar - Optional, hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search..."
            className="input w-full h-9 pl-9 pr-4"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2">
        {/* Admin Badges */}
        {user?.isAdmin && (
          <span className="hidden sm:inline-flex badge-neutral">
            Admin
          </span>
        )}

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground shadow-sm bg-gradient-to-br from-primary to-primary/80">
          {initials}
        </div>
        <div className="hidden lg:flex flex-col text-left">
          <span className="text-sm font-medium leading-tight text-foreground">
            {name}
          </span>
          {email && (
            <span className="text-xs leading-tight text-muted-foreground">
              {email}
            </span>
          )}
        </div>
        <ChevronDown
          className={`hidden lg:block h-4 w-4 transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl py-1 animate-fade-in bg-card border border-border shadow-lg">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">
              {name}
            </p>
            {email && (
              <p className="text-xs mt-0.5 text-muted-foreground">
                {email}
              </p>
            )}
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/settings/profile');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <User className="h-4 w-4" />
              Your Profile
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/settings/appearance');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Palette className="h-4 w-4" />
              Appearance
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/settings/security');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Shield className="h-4 w-4" />
              Security
            </button>
          </div>

          <div className="py-1 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-destructive hover:bg-destructive/10"
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
