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
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Logo & Brand */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
          style={{ background: 'var(--gradient-brand)' }}
        >
          HW
        </div>
        <div className="hidden sm:block">
          <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            HubbleWave
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Envision at your own ease
          </span>
        </div>
      </div>

      {/* Search Bar - Optional, hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--text-muted)' }}
          />
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
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          />
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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
          style={{ background: 'var(--gradient-brand)' }}
        >
          {initials}
        </div>
        <div className="hidden lg:flex flex-col text-left">
          <span className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
            {name}
          </span>
          {email && (
            <span className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
              {email}
            </span>
          )}
        </div>
        <ChevronDown
          className={`hidden lg:block h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl py-1 animate-fade-in"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {name}
            </p>
            {email && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <User className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              Your Profile
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Settings className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              Settings
            </button>
          </div>

          <div className="py-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
              style={{ color: 'var(--text-danger)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-danger-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
