import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  UserCheck,
  Users,
  Clock,
  Activity,
  AlertTriangle,
  Check,
  Loader2,
  Play,
  XCircle,
  Eye,
} from 'lucide-react';
import { authService } from '../../services/auth';
import { useAuth } from '../../auth/AuthContext';

interface ImpersonationSession {
  id: string;
  impersonator?: { id: string; email: string; displayName: string };
  targetUser?: { id: string; email: string; displayName: string };
  reason: string;
  isActive: boolean;
  startedAt: Date;
  endedAt?: Date;
  expiresAt: Date;
  actionsCount: number;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: Date, end: Date): string {
  const diff = end.getTime() - start.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function ImpersonationPage() {
  const { hasPermission } = useAuth();
  const [sessions, setSessions] = useState<ImpersonationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Start impersonation state
  const [showStartModal, setShowStartModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(60);
  const [starting, setStarting] = useState(false);

  const canImpersonate = hasPermission('users.impersonate');
  const canViewAudit = hasPermission('system.audit');
  const canTerminateAll = hasPermission('system.admin');

  const loadSessions = async () => {
    if (!canViewAudit) return;

    try {
      setLoading(true);
      const result = await authService.listImpersonationSessions({
        activeOnly,
        limit: 50,
      });
      setSessions(result.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setMessage({ type: 'error', text: 'Failed to load impersonation sessions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [activeOnly, canViewAudit]);

  const handleStartImpersonation = async () => {
    if (!targetEmail || !reason) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      setStarting(true);
      const result = await authService.startImpersonation(targetEmail, reason, duration);

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setShowStartModal(false);
        setTargetEmail('');
        setReason('');
        // Reload the page to apply impersonation
        window.location.reload();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to start impersonation' });
    } finally {
      setStarting(false);
    }
  };

  const handleTerminateAll = async () => {
    if (!confirm('Are you sure you want to terminate ALL active impersonation sessions? This is an emergency action.')) {
      return;
    }

    try {
      const result = await authService.terminateAllImpersonations();
      setMessage({ type: 'success', text: result.message });
      await loadSessions();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to terminate sessions' });
    }
  };

  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
            <UserCheck className="h-7 w-7 text-primary" />
            User Impersonation
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Impersonate users for troubleshooting. All actions are logged and audited.
          </p>
        </div>
        <div className="flex gap-3">
          {canTerminateAll && activeSessions.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleTerminateAll}
              className="text-destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Terminate All
            </Button>
          )}
          {canImpersonate && (
            <Button onClick={() => setShowStartModal(true)}>
              <Play className="h-4 w-4 mr-2" />
              Start Impersonation
            </Button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-success-subtle text-success-text'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto text-sm opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Warning Card */}
      <Card className="p-5 flex items-start gap-4 bg-warning-subtle border border-warning-border">
        <AlertTriangle className="h-6 w-6 flex-shrink-0 text-warning-text" />
        <div>
          <h3 className="font-medium text-foreground">
            Important Security Notice
          </h3>
          <p className="text-sm mt-1 text-muted-foreground">
            User impersonation is a powerful administrative feature. All actions taken while impersonating
            a user are logged with full audit trail. Use this feature responsibly and only for legitimate
            support and troubleshooting purposes.
          </p>
        </div>
      </Card>

      {/* Active Sessions Count */}
      {activeSessions.length > 0 && (
        <Card className="p-5 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning-subtle">
                <Activity className="h-6 w-6 text-warning-text" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {activeSessions.length} Active Impersonation{activeSessions.length !== 1 ? 's' : ''}
                </div>
                <div className="text-sm text-muted-foreground">
                  Currently active impersonation sessions in the system
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">
          Filter:
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveOnly(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeOnly
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Active Only
          </button>
          <button
            onClick={() => setActiveOnly(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !activeOnly
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            All Sessions
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <Card className="divide-y divide-border border border-border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {activeOnly ? 'No active impersonation sessions' : 'No impersonation sessions found'}
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        session.isActive
                          ? 'animate-pulse bg-success-subtle text-success-text'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {session.isActive ? 'Active' : 'Ended'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(session.startedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground">
                      {session.impersonator?.displayName || session.impersonator?.email || 'Unknown'}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">
                      {session.targetUser?.displayName || session.targetUser?.email || 'Unknown'}
                    </span>
                  </div>

                  <p className="text-sm mb-3 text-muted-foreground">
                    Reason: {session.reason}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {session.endedAt
                        ? `Duration: ${formatDuration(session.startedAt, session.endedAt)}`
                        : `Expires: ${formatDate(session.expiresAt)}`}
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {session.actionsCount} action{session.actionsCount !== 1 ? 's' : ''} logged
                    </div>
                  </div>
                </div>

                <Button variant="secondary" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Start Impersonation Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
          <Card className="w-full max-w-md p-6 border border-border">
            <h2 className="text-xl font-semibold mb-6 text-foreground">
              Start Impersonation
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  User Email or ID *
                </label>
                <input
                  type="text"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full p-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Reason *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Troubleshooting ticket #12345..."
                  rows={3}
                  className="w-full p-3 rounded-xl resize-none bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full p-3 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-warning-subtle">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning-text" />
                  <span className="text-sm font-medium text-foreground">
                    All actions will be logged
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every action you take while impersonating will be recorded with full audit trail.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowStartModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleStartImpersonation}
                disabled={starting || !targetEmail || !reason}
                className="flex-1"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Impersonation'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
