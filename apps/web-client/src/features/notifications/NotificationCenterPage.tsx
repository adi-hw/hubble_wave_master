/**
 * NotificationCenterPage
 * HubbleWave Platform - Phase 4
 *
 * Full-page notification center for viewing and managing notifications.
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Search,
  ChevronRight,
  Clock,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassInput } from '../../components/ui/glass/GlassInput';
import { Badge } from '../../components/ui/Badge';

interface InAppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  dismissed: boolean;
  readAt?: string;
  dismissedAt?: string;
  deepLink?: string;
  recordId?: string;
  collectionId?: string;
  actions?: Array<{
    id: string;
    label: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  createdAt: string;
}

interface GroupedNotifications {
  today: InAppNotification[];
  yesterday: InAppNotification[];
  thisWeek: InAppNotification[];
  older: InAppNotification[];
}

const priorityConfig = {
  low: { color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Info },
  medium: { color: 'text-info-text', bgColor: 'bg-info-subtle', icon: Info },
  high: { color: 'text-warning-text', bgColor: 'bg-warning-subtle', icon: AlertTriangle },
  urgent: { color: 'text-danger-text', bgColor: 'bg-danger-subtle', icon: AlertCircle },
};

export const NotificationCenterPage: React.FC = () => {
  const [notifications, setNotifications] = useState<GroupedNotifications>({
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  });
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/in-app/grouped');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/in-app/unread-count');
      if (!response.ok) throw new Error('Failed to fetch unread count');
      const data = await response.json();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/in-app/${id}/read`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error('Failed to mark as read');

      updateNotificationInState(id, { read: true, readAt: new Date().toISOString() });
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/in-app/mark-all-read', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark all as read');

      const now = new Date().toISOString();
      setNotifications((prev) => ({
        today: prev.today.map((n) => ({ ...n, read: true, readAt: now })),
        yesterday: prev.yesterday.map((n) => ({ ...n, read: true, readAt: now })),
        thisWeek: prev.thisWeek.map((n) => ({ ...n, read: true, readAt: now })),
        older: prev.older.map((n) => ({ ...n, read: true, readAt: now })),
      }));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/in-app/${id}/dismiss`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error('Failed to dismiss');

      removeNotificationFromState(id);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleDismissAll = async () => {
    try {
      const response = await fetch('/api/notifications/in-app/dismiss-all', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to dismiss all');

      setNotifications({
        today: [],
        yesterday: [],
        thisWeek: [],
        older: [],
      });
      setUnreadCount(0);
    } catch (error) {
      console.error('Error dismissing all:', error);
    }
  };

  const handleAction = async (notificationId: string, actionId: string) => {
    try {
      const response = await fetch(
        `/api/notifications/in-app/${notificationId}/action/${actionId}`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to execute action');

      updateNotificationInState(notificationId, { read: true });
    } catch (error) {
      console.error('Error executing action:', error);
    }
  };

  const updateNotificationInState = (
    id: string,
    updates: Partial<InAppNotification>
  ) => {
    setNotifications((prev) => ({
      today: prev.today.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      yesterday: prev.yesterday.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      thisWeek: prev.thisWeek.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      older: prev.older.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  };

  const removeNotificationFromState = (id: string) => {
    setNotifications((prev) => ({
      today: prev.today.filter((n) => n.id !== id),
      yesterday: prev.yesterday.filter((n) => n.id !== id),
      thisWeek: prev.thisWeek.filter((n) => n.id !== id),
      older: prev.older.filter((n) => n.id !== id),
    }));
  };

  const filterNotifications = (items: InAppNotification[]) => {
    let filtered = items;

    if (filter === 'unread') {
      filtered = filtered.filter((n) => !n.read);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.body.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const totalCount =
    notifications.today.length +
    notifications.yesterday.length +
    notifications.thisWeek.length +
    notifications.older.length;

  const renderNotificationGroup = (
    title: string,
    items: InAppNotification[]
  ) => {
    const filtered = filterNotifications(items);
    if (filtered.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          {title}
        </h3>
        <div className="space-y-2">
          {filtered.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={() => handleMarkAsRead(notification.id)}
              onDismiss={() => handleDismiss(notification.id)}
              onAction={(actionId) => handleAction(notification.id, actionId)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-subtle rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <GlassButton onClick={handleMarkAllAsRead} variant="ghost" size="sm">
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark All Read
            </GlassButton>
          )}
          {totalCount > 0 && (
            <GlassButton onClick={handleDismissAll} variant="ghost" size="sm">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </GlassButton>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <GlassInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            leftAddon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === 'unread'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 bg-muted rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <GlassCard className="p-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No notifications
          </h3>
          <p className="text-sm text-muted-foreground">
            You're all caught up! New notifications will appear here.
          </p>
        </GlassCard>
      ) : (
        <>
          {renderNotificationGroup('Today', notifications.today)}
          {renderNotificationGroup('Yesterday', notifications.yesterday)}
          {renderNotificationGroup('This Week', notifications.thisWeek)}
          {renderNotificationGroup('Older', notifications.older)}
        </>
      )}
    </div>
  );
};

// Notification Item Component
const NotificationItem: React.FC<{
  notification: InAppNotification;
  onMarkAsRead: () => void;
  onDismiss: () => void;
  onAction: (actionId: string) => void;
}> = ({ notification, onMarkAsRead, onDismiss, onAction }) => {
  const config = priorityConfig[notification.priority];
  const PriorityIcon = config.icon;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <GlassCard
      className={`p-4 ${
        !notification.read
          ? 'border-l-4 border-l-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
          : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Priority Icon */}
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <PriorityIcon className={`h-5 w-5 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4
                className={`font-medium ${
                  notification.read
                    ? 'text-muted-foreground'
                    : 'text-foreground'
                }`}
              >
                {notification.title}
              </h4>
              <p className="text-sm text-muted-foreground mt-0.5">
                {notification.body}
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.read && (
                <button
                  onClick={onMarkAsRead}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary-subtle rounded-md transition-colors"
                  title="Mark as read"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onDismiss}
                className="p-1.5 text-muted-foreground hover:text-danger-text hover:bg-danger-subtle rounded-md transition-colors"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {notification.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onAction(action.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    action.style === 'primary'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : action.style === 'danger'
                      ? 'bg-danger-subtle text-danger-text hover:bg-danger-subtle'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(notification.createdAt)}</span>
            {notification.priority === 'urgent' && (
              <Badge className="bg-danger-subtle text-danger-text text-xs">Urgent</Badge>
            )}
            {notification.priority === 'high' && (
              <Badge className="bg-warning-subtle text-warning-text text-xs">High Priority</Badge>
            )}
          </div>
        </div>

        {/* Deep Link Arrow */}
        {notification.deepLink && (
          <a
            href={notification.deepLink}
            className="p-2 text-muted-foreground hover:text-primary rounded-md transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </a>
        )}
      </div>
    </GlassCard>
  );
};

export default NotificationCenterPage;
