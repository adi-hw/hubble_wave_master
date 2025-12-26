import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  Shield,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Clock,
  Trash2,
  LogOut,
  AlertTriangle,
  Check,
  Loader2,
  Key,
  Mail,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { authService, Session } from '../services/auth';
import { useAuth } from '../auth/AuthContext';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    default:
      return Monitor;
  }
}

interface EmailVerificationStatus {
  emailVerified: boolean;
  email: string;
  emailVerifiedAt: Date | null;
  canResend: boolean;
  resendAvailableAt: Date | null;
}

export function SecuritySettingsPage() {
  const { auth } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailVerificationStatus | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await authService.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setMessage({ type: 'error', text: 'Failed to load sessions' });
    } finally {
      setLoading(false);
    }
  };

  const loadEmailStatus = async () => {
    try {
      const status = await authService.getEmailVerificationStatus();
      setEmailStatus(status);
    } catch (err) {
      console.error('Failed to load email verification status:', err);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResendingEmail(true);
      await authService.resendVerificationEmail();
      setMessage({ type: 'success', text: 'Verification email sent! Check your inbox.' });
      // Refresh status
      await loadEmailStatus();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to send verification email';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setResendingEmail(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadEmailStatus();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevoking(sessionId);
      await authService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setMessage({ type: 'success', text: 'Session revoked successfully' });
    } catch (err) {
      console.error('Failed to revoke session:', err);
      setMessage({ type: 'error', text: 'Failed to revoke session' });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      setRevokingAll(true);
      await authService.revokeAllOtherSessions();
      // Reload sessions to show only current
      await loadSessions();
      setMessage({ type: 'success', text: 'All other sessions revoked successfully' });
    } catch (err) {
      console.error('Failed to revoke sessions:', err);
      setMessage({ type: 'error', text: 'Failed to revoke sessions' });
    } finally {
      setRevokingAll(false);
    }
  };

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Security Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage your account security, active sessions, and authentication settings.
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{
            backgroundColor: message.type === 'success' ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
            color: message.type === 'success' ? 'var(--text-success)' : 'var(--text-danger)',
          }}
        >
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-sm opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Email Verification */}
      {emailStatus && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Mail className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            Email Verification
          </h2>
          <Card className="p-5" style={{ border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: emailStatus.emailVerified
                      ? 'var(--bg-success-subtle)'
                      : 'var(--bg-warning-subtle)',
                  }}
                >
                  {emailStatus.emailVerified ? (
                    <CheckCircle
                      className="h-6 w-6"
                      style={{ color: 'var(--color-success-500)' }}
                    />
                  ) : (
                    <XCircle
                      className="h-6 w-6"
                      style={{ color: 'var(--color-warning-500)' }}
                    />
                  )}
                </div>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {emailStatus.email}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {emailStatus.emailVerified
                      ? `Verified${emailStatus.emailVerifiedAt ? ` on ${new Date(emailStatus.emailVerifiedAt).toLocaleDateString()}` : ''}`
                      : 'Email not verified - check your inbox for a verification link'}
                  </div>
                </div>
              </div>
              {!emailStatus.emailVerified && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={resendingEmail || !emailStatus.canResend}
                >
                  {resendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Resend Email
                </Button>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Current Session */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Shield className="h-5 w-5" style={{ color: 'var(--text-brand)' }} />
          Current Session
        </h2>
        <Card className="p-5" style={{ border: '1px solid var(--border-default)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : currentSession ? (
            <div className="flex items-start gap-4">
              <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
              >
                {React.createElement(getDeviceIcon(currentSession.deviceType), {
                  className: 'h-6 w-6',
                  style: { color: 'var(--text-brand)' },
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {currentSession.browser}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--bg-success-subtle)',
                      color: 'var(--text-success)',
                    }}
                  >
                    Current
                  </span>
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {currentSession.os}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {currentSession.ipAddress}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(new Date(currentSession.lastActive))}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No session information available
            </p>
          )}
        </Card>
      </section>

      {/* Other Sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Monitor className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            Other Active Sessions
            {otherSessions.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' }}
              >
                {otherSessions.length}
              </span>
            )}
          </h2>
          {otherSessions.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRevokeAllOthers}
              disabled={revokingAll}
            >
              {revokingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign out all others
            </Button>
          )}
        </div>

        <Card className="divide-y" style={{ border: '1px solid var(--border-default)', borderColor: 'var(--border-subtle)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : otherSessions.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No other active sessions
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                You're only signed in on this device
              </p>
            </div>
          ) : (
            otherSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 flex items-start gap-4"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="p-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
                >
                  {React.createElement(getDeviceIcon(session.deviceType), {
                    className: 'h-5 w-5',
                    style: { color: 'var(--text-secondary)' },
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {session.browser}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {session.os}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {session.ipAddress}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(new Date(session.lastActive))}
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revoking === session.id}
                  className="flex-shrink-0"
                >
                  {revoking === session.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* Account Security */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Key className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
          Account Security
        </h2>
        <Card className="divide-y" style={{ border: '1px solid var(--border-default)', borderColor: 'var(--border-subtle)' }}>
          {/* Password */}
          <div className="p-5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Password
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Last changed: Unknown
              </div>
            </div>
            <Button variant="secondary" size="sm">
              Change Password
            </Button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="p-5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Two-Factor Authentication
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {auth.user?.mfaEnabled
                  ? 'Enabled - Your account has additional security'
                  : 'Not enabled - Add an extra layer of security'}
              </div>
            </div>
            <Button variant={auth.user?.mfaEnabled ? 'secondary' : 'primary'} size="sm">
              {auth.user?.mfaEnabled ? 'Manage' : 'Enable'}
            </Button>
          </div>

          {/* Recovery Codes */}
          <div className="p-5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Recovery Codes
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Backup codes for account recovery
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled={!auth.user?.mfaEnabled}>
              View Codes
            </Button>
          </div>
        </Card>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-danger)' }}>
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </h2>
        <Card
          className="p-5"
          style={{
            border: '1px solid var(--text-danger)',
            backgroundColor: 'var(--bg-danger-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Sign out everywhere
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Sign out of all sessions on all devices, including this one.
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (confirm('Are you sure you want to sign out of all devices? You will need to log in again.')) {
                  authService.logout();
                }
              }}
              style={{ color: 'var(--text-danger)', borderColor: 'var(--text-danger)' }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out everywhere
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
