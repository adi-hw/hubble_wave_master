/**
 * AppHeaderV2 - Enhanced Application Header
 *
 * A modern header with:
 * - Sidebar toggle
 * - Global search trigger (⌘K)
 * - AVA assistant trigger (⌘J)
 * - Notification center
 * - User menu
 * - Responsive design
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useProfile } from '../../auth/useProfile';
import {
  LogOut,
  Settings,
  User,
  ChevronDown,
  Search,
  Shield,
  Menu,
  Command,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import { NotificationDropdown, Notification } from './NotificationDropdown';
import { GlassButton } from '../ui/glass/GlassButton';
import { GlassAvatar } from '../ui/glass/GlassAvatar';
import { ShortcutTooltip } from '../ui/glass/GlassTooltip';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notification.service';

interface AppHeaderV2Props {
  onOpenCommandPalette: () => void;
  onOpenAva: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export const AppHeaderV2: React.FC<AppHeaderV2Props> = ({
  onOpenCommandPalette,
  onOpenAva,
  onToggleSidebar,
  // sidebarCollapsed is available for future use (e.g., showing different icon)
}) => {
  const { auth } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const user = auth.user;
  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';

  const initials = displayName
    .split(' ')
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Fetch notifications
  useEffect(() => {
    if (!notificationService.enabled) {
      setNotifications([]);
      setNotificationsError('Notifications service unavailable');
      return;
    }

    let active = true;
    const load = async () => {
      try {
        setNotificationsLoading(true);
        const data = await notificationService.list();
        if (!active) return;
        setNotifications(
          data.map((n) => ({
            ...n,
            createdAt: new Date(n.createdAt),
          }))
        );
      } catch (err) {
        console.error('Failed to load notifications', err);
        if (active) {
          setNotificationsError('Unable to load notifications');
        }
      } finally {
        if (active) {
          setNotificationsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await notificationService.markRead(id);
    } catch (err) {
      console.warn('Failed to mark notification read', err);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationService.markAllRead();
    } catch (err) {
      console.warn('Failed to mark all notifications read', err);
    }
  };

  const handleDismiss = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationService.dismiss(id);
    } catch (err) {
      console.warn('Failed to dismiss notification', err);
    }
  };

  const handleClearAll = async () => {
    setNotifications([]);
    try {
      await notificationService.clearAll();
    } catch (err) {
      console.warn('Failed to clear notifications', err);
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[var(--z-header)] flex items-center justify-between px-4 glass-surface-elevated"
      style={{
        height: 'var(--header-height, 64px)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Left Section: Toggle + Logo */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onToggleSidebar}
          className="md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </GlassButton>

        {/* Logo */}
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
            <span className="ml-2 text-xs hidden lg:inline" style={{ color: 'var(--text-muted)' }}>
              Envision at your own ease
            </span>
          </div>
        </div>
      </div>

      {/* Center Section: Search Bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <button
          onClick={onOpenCommandPalette}
          className={cn(
            'w-full flex items-center gap-3 px-3 h-9 rounded-lg text-left transition-colors',
            'bg-[var(--bg-surface-secondary)]',
            'border border-[var(--border-default)]',
            'hover:border-[var(--border-hover)]'
          )}
        >
          <Search className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <span className="flex-1 text-sm" style={{ color: 'var(--text-placeholder)' }}>
            Search or type a command...
          </span>
          <kbd className="kbd">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Mobile search */}
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onOpenCommandPalette}
          className="md:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </GlassButton>

        {/* AVA Button */}
        <ShortcutTooltip label="Ask AVA" shortcut="⌘J" side="bottom">
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onOpenAva}
            aria-label="Open AVA assistant"
            className="hidden sm:flex"
          >
            <Sparkles className="h-5 w-5" style={{ color: 'var(--text-accent)' }} />
          </GlassButton>
        </ShortcutTooltip>

        {/* Admin Badge */}
        {user?.isAdmin && (
          <span className="hidden sm:inline-flex badge-neutral text-[10px]">
            Admin
          </span>
        )}

        {/* Notifications */}
        <NotificationDropdown
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onDismiss={handleDismiss}
          onClearAll={handleClearAll}
          loading={notificationsLoading}
          error={notificationsError}
        />

        {/* User Menu */}
        <UserMenuV2
          initials={initials}
          name={displayName}
          email={user?.email}
          avatarUrl={(profile as { avatarUrl?: string })?.avatarUrl}
          onNavigate={navigate}
        />
      </div>
    </header>
  );
};

interface UserMenuV2Props {
  initials: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  onNavigate: (path: string) => void;
}

const UserMenuV2: React.FC<UserMenuV2Props> = ({
  // initials kept for potential future use
  name,
  email,
  avatarUrl,
  onNavigate,
}) => {
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

  const menuItems = [
    { icon: User, label: 'Your Profile', path: '/settings/profile' },
    { icon: Settings, label: 'Preferences', path: '/settings' },
    { icon: Shield, label: 'Security', path: '/settings/security' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
          isOpen && 'bg-[var(--bg-hover)]'
        )}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <GlassAvatar
          src={avatarUrl}
          fallback={name}
          size="sm"
          status="online"
        />
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
          className={cn(
            'hidden lg:block h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl py-1 animate-fade-in glass-surface-elevated"
          style={{
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 'var(--z-dropdown)',
          }}
        >
          {/* User Info */}
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

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  setIsOpen(false);
                  onNavigate(item.path);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <item.icon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="py-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-[var(--bg-danger-subtle)]"
              style={{ color: 'var(--text-danger)' }}
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

export default AppHeaderV2;
