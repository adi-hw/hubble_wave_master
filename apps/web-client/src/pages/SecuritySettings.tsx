import React, { useState, useEffect, useRef } from 'react';
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
  Fingerprint,
  Plus,
  Copy,
  Download,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  Bell,
  X,
  Edit3,
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

interface Passkey {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  signCount: number;
}

interface TrustedDevice {
  id: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  status: string;
  lastSeenAt: Date;
  trustedUntil?: Date;
}

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: string;
  createdAt: Date;
}

type ModalType =
  | 'mfa-setup'
  | 'mfa-disable'
  | 'recovery-codes'
  | 'change-password'
  | 'passkey-add'
  | 'passkey-rename'
  | null;

export function SecuritySettingsPage() {
  const { auth, refreshUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailVerificationStatus | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  // MFA State
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; type?: string } | null>(null);
  const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; recoveryCodes: string[] } | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaSetupStep, setMfaSetupStep] = useState<'qr' | 'verify' | 'success'>('qr');
  const [mfaLoading, setMfaLoading] = useState(false);

  // Passkeys State
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [selectedPasskey, setSelectedPasskey] = useState<Passkey | null>(null);
  const [passkeyNewName, setPasskeyNewName] = useState('');

  // Trusted Devices State
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [trustedDevicesLoading, setTrustedDevicesLoading] = useState(false);

  // Security Alerts State
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Modal State
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const verifyInputRef = useRef<HTMLInputElement>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await authService.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      // Create a fallback current session from browser info
      const userAgent = navigator.userAgent;
      const browser = getBrowserName(userAgent);
      const os = getOSName(userAgent);
      const fallbackSession: Session = {
        id: 'current',
        deviceType: getDeviceType(),
        browser,
        os,
        ipAddress: 'Local',
        lastActive: new Date(),
        isCurrent: true,
        createdAt: new Date(),
      };
      setSessions([fallbackSession]);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to parse user agent
  const getBrowserName = (ua: string): string => {
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Microsoft Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    return 'Unknown Browser';
  };

  const getOSName = (ua: string): string => {
    if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown OS';
  };

  const getDeviceType = (): 'desktop' | 'mobile' | 'tablet' => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
    return 'desktop';
  };

  const loadEmailStatus = async () => {
    try {
      const status = await authService.getEmailVerificationStatus();
      setEmailStatus(status);
    } catch (err) {
      console.error('Failed to load email verification status:', err);
    }
  };

  const loadMfaStatus = async () => {
    try {
      const status = await authService.getMfaStatus();
      setMfaStatus(status);
    } catch (err) {
      console.error('Failed to load MFA status:', err);
    }
  };

  const loadPasskeys = async () => {
    try {
      setPasskeysLoading(true);
      const data = await authService.listPasskeys();
      setPasskeys(data);
    } catch (err) {
      console.error('Failed to load passkeys:', err);
    } finally {
      setPasskeysLoading(false);
    }
  };

  const loadTrustedDevices = async () => {
    try {
      setTrustedDevicesLoading(true);
      const data = await authService.listTrustedDevices();
      setTrustedDevices(data);
    } catch (err) {
      console.error('Failed to load trusted devices:', err);
    } finally {
      setTrustedDevicesLoading(false);
    }
  };

  const loadSecurityAlerts = async () => {
    try {
      setAlertsLoading(true);
      const data = await authService.getSecurityAlerts({ limit: 5 });
      setSecurityAlerts(data.alerts);
    } catch (err) {
      console.error('Failed to load security alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResendingEmail(true);
      await authService.resendVerificationEmail();
      setMessage({ type: 'success', text: 'Verification email sent! Check your inbox.' });
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
    loadMfaStatus();
    loadPasskeys();
    loadTrustedDevices();
    loadSecurityAlerts();
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
      await loadSessions();
      setMessage({ type: 'success', text: 'All other sessions revoked successfully' });
    } catch (err) {
      console.error('Failed to revoke sessions:', err);
      setMessage({ type: 'error', text: 'Failed to revoke sessions' });
    } finally {
      setRevokingAll(false);
    }
  };

  // MFA Handlers
  const handleStartMfaSetup = async () => {
    try {
      setMfaLoading(true);
      const data = await authService.startMfaEnrollment();
      setMfaSetupData({ qrCode: data.qrCode, recoveryCodes: data.recoveryCodes });
      setMfaSetupStep('qr');
      setActiveModal('mfa-setup');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to start MFA setup' });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfaEnrollment = async () => {
    if (mfaVerifyCode.length !== 6) return;

    try {
      setMfaLoading(true);
      const result = await authService.verifyMfaEnrollment(mfaVerifyCode);
      if (result.success) {
        setMfaSetupStep('success');
        await loadMfaStatus();
        refreshUser();
      } else {
        setMessage({ type: 'error', text: 'Invalid code. Please try again.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to verify code' });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      setMfaLoading(true);
      await authService.disableMfa();
      await loadMfaStatus();
      refreshUser();
      setActiveModal(null);
      setMessage({ type: 'success', text: 'Two-factor authentication disabled' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to disable MFA' });
    } finally {
      setMfaLoading(false);
    }
  };

  // Password Change Handler
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 12) {
      setMessage({ type: 'error', text: 'Password must be at least 12 characters' });
      return;
    }

    try {
      setPasswordLoading(true);
      await authService.changePassword(currentPassword, newPassword);
      setActiveModal(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to change password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Passkey Handlers
  const handleAddPasskey = async () => {
    try {
      setPasskeysLoading(true);
      const options = await authService.startPasskeyRegistration();

      // Convert options for WebAuthn API
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0)),
        rp: { id: options.rpId, name: options.rpName },
        user: {
          id: Uint8Array.from(atob(options.user.id), (c) => c.charCodeAt(0)),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams.map((p) => ({
          type: p.type as 'public-key',
          alg: p.alg,
        })),
        authenticatorSelection: {
          authenticatorAttachment: options.authenticatorSelection.authenticatorAttachment as AuthenticatorAttachment | undefined,
          requireResidentKey: options.authenticatorSelection.requireResidentKey,
          userVerification: options.authenticatorSelection.userVerification as UserVerificationRequirement,
        },
        timeout: options.timeout,
        attestation: options.attestation as AttestationConveyancePreference,
        excludeCredentials: options.excludeCredentials.map((c) => ({
          id: Uint8Array.from(atob(c.id), (ch) => ch.charCodeAt(0)),
          type: c.type as 'public-key',
          transports: c.transports as AuthenticatorTransport[],
        })),
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const response = credential.response as AuthenticatorAttestationResponse;

      await authService.completePasskeyRegistration({
        attestation: {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          type: 'public-key',
          response: {
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
            attestationObject: btoa(String.fromCharCode(...new Uint8Array(response.attestationObject))),
            transports: response.getTransports?.() || [],
          },
        },
      });

      await loadPasskeys();
      setActiveModal(null);
      setMessage({ type: 'success', text: 'Passkey added successfully' });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setMessage({ type: 'error', text: 'Passkey registration was cancelled' });
      } else {
        setMessage({ type: 'error', text: err?.message || 'Failed to add passkey' });
      }
    } finally {
      setPasskeysLoading(false);
    }
  };

  const handleRenamePasskey = async () => {
    if (!selectedPasskey || !passkeyNewName.trim()) return;

    try {
      setPasskeysLoading(true);
      await authService.renamePasskey(selectedPasskey.id, passkeyNewName.trim());
      await loadPasskeys();
      setActiveModal(null);
      setSelectedPasskey(null);
      setPasskeyNewName('');
      setMessage({ type: 'success', text: 'Passkey renamed successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to rename passkey' });
    } finally {
      setPasskeysLoading(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    if (!confirm('Are you sure you want to delete this passkey?')) return;

    try {
      setPasskeysLoading(true);
      await authService.deletePasskey(passkeyId);
      await loadPasskeys();
      setMessage({ type: 'success', text: 'Passkey deleted successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to delete passkey' });
    } finally {
      setPasskeysLoading(false);
    }
  };

  // Trusted Device Handlers
  const handleRevokeTrustedDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke trust for this device?')) return;

    try {
      setTrustedDevicesLoading(true);
      await authService.revokeTrustedDevice(deviceId);
      await loadTrustedDevices();
      setMessage({ type: 'success', text: 'Device trust revoked' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to revoke device' });
    } finally {
      setTrustedDevicesLoading(false);
    }
  };

  // Security Alert Handlers
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await authService.acknowledgeSecurityAlert(alertId);
      await loadSecurityAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard' });
  };

  const downloadRecoveryCodes = () => {
    if (!mfaSetupData?.recoveryCodes) return;
    const content = `HubbleWave Recovery Codes\n\nKeep these codes safe. Each can only be used once.\n\n${mfaSetupData.recoveryCodes.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hubblewave-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const newAlerts = securityAlerts.filter((a) => a.status === 'new');

  const getSeverityClasses = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-danger/20', text: 'text-danger' };
      case 'high':
        return { bg: 'bg-warning/20', text: 'text-warning' };
      case 'medium':
        return { bg: 'bg-primary/20', text: 'text-primary' };
      default:
        return { bg: 'bg-muted', text: 'text-muted-foreground' };
    }
  };

  // Modal Components
  const renderMfaSetupModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <Card className="w-full max-w-md p-6 relative border border-border">
        <button
          onClick={() => setActiveModal(null)}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {mfaSetupStep === 'qr' && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Set up Two-Factor Authentication
            </h2>
            <p className="text-sm mb-6 text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>

            {mfaSetupData?.qrCode && (
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-card rounded-xl">
                  <img src={mfaSetupData.qrCode} alt="MFA QR Code" className="w-48 h-48" />
                </div>
              </div>
            )}

            <Button onClick={() => setMfaSetupStep('verify')} className="w-full">
              Continue
            </Button>
          </>
        )}

        {mfaSetupStep === 'verify' && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Verify Setup
            </h2>
            <p className="text-sm mb-6 text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </p>

            <input
              ref={verifyInputRef}
              type="text"
              value={mfaVerifyCode}
              onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full p-4 text-center text-2xl font-mono rounded-xl mb-6 bg-muted border border-border text-foreground tracking-[0.5em]"
              maxLength={6}
            />

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setMfaSetupStep('qr')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleVerifyMfaEnrollment}
                disabled={mfaVerifyCode.length !== 6 || mfaLoading}
                className="flex-1"
              >
                {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </>
        )}

        {mfaSetupStep === 'success' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-success/10">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-foreground">
                Two-Factor Authentication Enabled
              </h2>
              <p className="text-sm text-muted-foreground">
                Save your recovery codes in a safe place
              </p>
            </div>

            <div className="p-4 rounded-xl mb-6 bg-muted">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">
                  Recovery Codes
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(mfaSetupData?.recoveryCodes?.join('\n') || '')}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={downloadRecoveryCodes}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mfaSetupData?.recoveryCodes?.map((code, i) => (
                  <code
                    key={i}
                    className="text-sm font-mono p-2 rounded bg-card text-foreground"
                  >
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <Button onClick={() => setActiveModal(null)} className="w-full">
              Done
            </Button>
          </>
        )}
      </Card>
    </div>
  );

  const renderMfaDisableModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <Card className="w-full max-w-md p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          Disable Two-Factor Authentication?
        </h2>
        <p className="text-sm mb-6 text-muted-foreground">
          This will reduce the security of your account. Are you sure you want to continue?
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setActiveModal(null)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDisableMfa}
            disabled={mfaLoading}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable MFA'}
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderChangePasswordModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <Card className="w-full max-w-md p-6 relative border border-border">
        <button
          onClick={() => setActiveModal(null)}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold mb-6 text-foreground">
          Change Password
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-3 pr-10 rounded-xl bg-muted border border-border text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 pr-10 rounded-xl bg-muted border border-border text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-muted border border-border text-foreground"
            />
          </div>

          <div className="text-xs space-y-1 text-muted-foreground">
            <p>Password must:</p>
            <ul className="list-disc list-inside">
              <li>Be at least 12 characters long</li>
              <li>Include uppercase and lowercase letters</li>
              <li>Include at least one number</li>
              <li>Include at least one special character</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setActiveModal(null)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="flex-1"
          >
            {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderPasskeyRenameModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <Card className="w-full max-w-md p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          Rename Passkey
        </h2>

        <input
          type="text"
          value={passkeyNewName}
          onChange={(e) => setPasskeyNewName(e.target.value)}
          placeholder="Enter new name"
          className="w-full p-3 rounded-xl mb-6 bg-muted border border-border text-foreground"
        />

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setActiveModal(null);
              setSelectedPasskey(null);
              setPasskeyNewName('');
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRenamePasskey}
            disabled={!passkeyNewName.trim() || passkeysLoading}
            className="flex-1"
          >
            {passkeysLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rename'}
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Security Settings
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          Manage your account security, active sessions, and authentication settings.
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
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

      {/* Security Alerts */}
      {newAlerts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
            <Bell className="h-5 w-5 text-warning" />
            Security Alerts
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
              {newAlerts.length} new
            </span>
          </h2>
          <Card className="divide-y divide-border border border-border">
            {alertsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              newAlerts.map((alert) => {
                const severityClasses = getSeverityClasses(alert.severity);
                return (
                <div key={alert.id} className="p-4 flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${severityClasses.bg}`}>
                    <AlertCircle className={`h-5 w-5 ${severityClasses.text}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {alert.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {alert.description}
                    </div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      {formatRelativeTime(alert.createdAt)}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handleAcknowledgeAlert(alert.id)}>
                    Dismiss
                  </Button>
                </div>
              );})
            )}
          </Card>
        </section>
      )}

      {/* Email Verification */}
      {emailStatus && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Email Verification
          </h2>
          <Card className="p-5 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    emailStatus.emailVerified ? 'bg-success/10' : 'bg-warning/10'
                  }`}
                >
                  {emailStatus.emailVerified ? (
                    <CheckCircle className="h-6 w-6 text-success" />
                  ) : (
                    <XCircle className="h-6 w-6 text-warning" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {emailStatus.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
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
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Shield className="h-5 w-5 text-primary" />
          Current Session
        </h2>
        <Card className="p-5 border border-border">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : currentSession ? (
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-muted">
                {React.createElement(getDeviceIcon(currentSession.deviceType), {
                  className: 'h-6 w-6 text-primary',
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {currentSession.browser}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                    Current
                  </span>
                </div>
                <div className="text-sm mt-1 text-muted-foreground">
                  {currentSession.os}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
              No session information available
            </p>
          )}
        </Card>
      </section>

      {/* Other Sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            Other Active Sessions
            {otherSessions.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {otherSessions.length}
              </span>
            )}
          </h2>
          {otherSessions.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleRevokeAllOthers} disabled={revokingAll}>
              {revokingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Sign out all others
            </Button>
          )}
        </div>

        <Card className="divide-y divide-border border border-border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : otherSessions.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No other active sessions
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                You're only signed in on this device
              </p>
            </div>
          ) : (
            otherSessions.map((session) => (
              <div key={session.id} className="p-4 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-muted">
                  {React.createElement(getDeviceIcon(session.deviceType), {
                    className: 'h-5 w-5 text-muted-foreground',
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {session.browser}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {session.os}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
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
                  {revoking === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* Passkeys */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Fingerprint className="h-5 w-5 text-muted-foreground" />
            Passkeys
            {passkeys.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {passkeys.length}
              </span>
            )}
          </h2>
          <Button variant="secondary" size="sm" onClick={handleAddPasskey} disabled={passkeysLoading}>
            {passkeysLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Passkey
          </Button>
        </div>

        <Card className="divide-y divide-border border border-border">
          {passkeysLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : passkeys.length === 0 ? (
            <div className="py-12 text-center">
              <Fingerprint className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No passkeys registered
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                Add a passkey for passwordless sign-in
              </p>
            </div>
          ) : (
            passkeys.map((passkey) => (
              <div key={passkey.id} className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-muted">
                  <Key className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {passkey.name}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Added {formatRelativeTime(passkey.createdAt)}</span>
                    {passkey.lastUsedAt && <span>Last used {formatRelativeTime(passkey.lastUsedAt)}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedPasskey(passkey);
                      setPasskeyNewName(passkey.name);
                      setActiveModal('passkey-rename');
                    }}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePasskey(passkey.id)}
                    className="p-2 rounded-lg hover:bg-muted text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* Trusted Devices */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Shield className="h-5 w-5 text-muted-foreground" />
          Trusted Devices
          {trustedDevices.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {trustedDevices.length}
            </span>
          )}
        </h2>

        <Card className="divide-y divide-border border border-border">
          {trustedDevicesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trustedDevices.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No trusted devices
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                Devices will appear here when you trust them during login
              </p>
            </div>
          ) : (
            trustedDevices.map((device) => (
              <div key={device.id} className="p-4 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-muted">
                  {React.createElement(getDeviceIcon(device.deviceType), {
                    className: 'h-5 w-5 text-muted-foreground',
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {device.deviceName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {device.browser} on {device.os}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Last seen {formatRelativeTime(device.lastSeenAt)}</span>
                    {device.trustedUntil && (
                      <span>Trusted until {new Date(device.trustedUntil).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRevokeTrustedDevice(device.id)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* Account Security */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Lock className="h-5 w-5 text-muted-foreground" />
          Account Security
        </h2>
        <Card className="divide-y divide-border border border-border">
          {/* Password */}
          <div className="p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Password
              </div>
              <div className="text-sm text-muted-foreground">
                Change your password regularly for better security
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setActiveModal('change-password')}>
              Change Password
            </Button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="p-5 flex items-center justify-between">
            <div>
              <div className="font-medium flex items-center gap-2 text-foreground">
                Two-Factor Authentication
                {(mfaStatus?.enabled || auth.user?.mfaEnabled) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                    Enabled
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {mfaStatus?.enabled || auth.user?.mfaEnabled
                  ? 'Your account is protected with an authenticator app'
                  : 'Add an extra layer of security with an authenticator app'}
              </div>
            </div>
            {mfaStatus?.enabled || auth.user?.mfaEnabled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveModal('mfa-disable')}
                className="text-destructive"
              >
                Disable
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleStartMfaSetup} disabled={mfaLoading}>
                {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enable
              </Button>
            )}
          </div>

          {/* Recovery Codes */}
          {(mfaStatus?.enabled || auth.user?.mfaEnabled) && (
            <div className="p-5 flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">
                  Recovery Codes
                </div>
                <div className="text-sm text-muted-foreground">
                  Backup codes for account recovery if you lose your device
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setActiveModal('recovery-codes')}>
                View Codes
              </Button>
            </div>
          )}
        </Card>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </h2>
        <Card className="p-5 border border-destructive bg-destructive/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Sign out everywhere
              </div>
              <div className="text-sm text-muted-foreground">
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
              className="text-destructive border-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out everywhere
            </Button>
          </div>
        </Card>
      </section>

      {/* Modals */}
      {activeModal === 'mfa-setup' && renderMfaSetupModal()}
      {activeModal === 'mfa-disable' && renderMfaDisableModal()}
      {activeModal === 'change-password' && renderChangePasswordModal()}
      {activeModal === 'passkey-rename' && renderPasskeyRenameModal()}
    </div>
  );
}
