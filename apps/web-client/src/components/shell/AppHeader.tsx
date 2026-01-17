/**
 * AppHeader - Application Header
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
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth';
import { NotificationDropdown, Notification } from './NotificationDropdown';
import { GlassButton } from '../ui/glass/GlassButton';
import { GlassAvatar } from '../ui/glass/GlassAvatar';
import { ShortcutTooltip } from '../ui/glass/GlassTooltip';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notification.service';

interface AppHeaderProps {
  onOpenCommandPalette: () => void;
  onOpenAva: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
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
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 border-b border-border glass-surface-elevated"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground shadow-glow bg-gradient-brand"
          >
            HW
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-semibold text-foreground">
              HubbleWave
            </span>
            <span className="ml-2 text-xs hidden lg:inline text-muted-foreground">
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
            'bg-muted',
            'border border-border',
            'hover:border-primary/50'
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">
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
            <Sparkles className="h-5 w-5 fill-indigo-500 text-indigo-400" />
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
        <UserMenu
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

interface UserMenuProps {
  initials: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  onNavigate: (path: string) => void;
}

const UserMenu: React.FC<UserMenuProps> = ({
  // initials kept for potential future use
  name,
  email,
  avatarUrl,
  onNavigate,
}) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

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
          'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted',
          isOpen && 'bg-muted'
        )}
      >
        <GlassAvatar
          src={avatarUrl}
          fallback={name}
          size="sm"
          status="online"
        />
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
          className={cn(
            'hidden lg:block h-4 w-4 transition-transform text-muted-foreground',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl py-1 animate-fade-in glass-surface-elevated border border-border shadow-lg z-50"
        >
          {/* User Info */}
          <div
            className="px-4 py-3 border-b border-border"
          >
            <p className="text-sm font-medium text-foreground">
              {name}
            </p>
            {email && (
              <p className="text-xs mt-0.5 text-muted-foreground">
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
                className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted text-foreground"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="py-1 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-destructive/10 text-destructive"
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

export default AppHeader;
