/**
 * NotificationDropdown - Notification Center UI
 *
 * A dropdown for viewing and managing notifications with:
 * - Real-time notification updates
 * - Mark as read (individual and bulk)
 * - Priority-based styling
 * - Action buttons
 * - Empty state
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Clock,
  MoreHorizontal,
  Settings,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../ui/glass/GlassButton';
import { NotificationBadge } from '../ui/glass/GlassBadge';

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'info' | 'warning' | 'danger' | 'success' | 'ava';
  isRead: boolean;
  createdAt: Date;
  actionUrl?: string;
  actionLabel?: string;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  className?: string;
  loading?: boolean;
  error?: string | null;
}

// Priority icons available for enhanced priority display
const _priorityIcons = {
  low: Info,
  medium: Info,
  high: AlertTriangle,
  critical: AlertCircle,
};
void _priorityIcons;

const typeStyles = {
  info: {
    icon: Info,
    bg: 'bg-info-subtle',
    color: 'text-info-text',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning-subtle',
    color: 'text-warning-text',
  },
  danger: {
    icon: AlertCircle,
    bg: 'bg-destructive/10',
    color: 'text-destructive',
  },
  success: {
    icon: Check,
    bg: 'bg-success-subtle',
    color: 'text-success-text',
  },
  ava: {
    icon: Sparkles,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
  className,
  loading = false,
  error = null,
}) => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close on navigation
  useEffect(() => {
    setOpen(false);
    setShowSettings(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSettings(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowSettings(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative p-2 rounded-lg transition-colors text-muted-foreground',
          'hover:bg-muted hover:text-foreground',
          open && 'bg-muted text-foreground'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1">
            <NotificationBadge count={unreadCount} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)]',
            'glass-surface-elevated rounded-xl shadow-xl animate-fade-in',
            'border border-border',
            'overflow-hidden z-50'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <GlassButton
                  variant="ghost"
                  size="xs"
                  onClick={() => onMarkAllRead()}
                  leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
                >
                  Mark all read
                </GlassButton>
              )}
              <GlassButton
                variant="ghost"
                size="xs"
                iconOnly
                onClick={() => setShowSettings(!showSettings)}
                aria-label="Notification settings"
              >
                <MoreHorizontal className="h-4 w-4" />
              </GlassButton>
            </div>
          </div>

          {/* Settings Menu */}
          {showSettings && (
            <div className="px-2 py-2 border-b border-border">
              <button
                onClick={() => {
                  navigate('/settings/notifications');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                Notification settings
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowSettings(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Clear all notifications
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="px-4 py-6 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
                Loading notifications...
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center text-destructive">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  No notifications
                </p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const typeConfig = typeStyles[notification.type];
                  const IconComponent = typeConfig.icon;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'relative px-4 py-3 transition-colors cursor-pointer',
                        'hover:bg-muted',
                        !notification.isRead && 'bg-primary/5'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                      )}

                      <div className="flex gap-3 pl-2">
                        {/* Icon */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                            typeConfig.bg
                          )}
                        >
                          <IconComponent className={cn('h-4 w-4', typeConfig.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium truncate text-foreground',
                              !notification.isRead && 'font-semibold'
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs mt-0.5 line-clamp-2 text-muted-foreground">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(notification.createdAt)}
                            </span>
                            {notification.actionLabel && (
                              <span className="text-[10px] font-medium text-primary">
                                {notification.actionLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-start gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkRead(notification.id);
                              }}
                              className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              aria-label="Mark as read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss(notification.id);
                            }}
                            className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 text-center border-t border-border">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setOpen(false);
                }}
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
