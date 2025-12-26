import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  Shield,
  Smartphone,
  Key,
  CheckCircle,
  Copy,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Download,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

// Design tokens - using CSS variables for theme consistency
const tokens = {
  colors: {
    voidPure: '#000000',
    voidDeep: '#030308',
    voidSpace: '#08080f',
    voidSurface: '#0f0f18',
    voidElevated: '#161622',
    voidOverlay: '#1e1e2e',
    // CSS variable references for theme-aware colors
    primary400: 'var(--color-primary-400)',
    primary500: 'var(--color-primary-500)',
    primary600: 'var(--color-primary-600)',
    accent400: 'var(--color-accent-400)',
    accent500: 'var(--color-accent-500)',
    success: 'var(--color-success-500)',
    warning: 'var(--color-warning-500)',
    danger: 'var(--color-danger-500)',
    gray100: 'var(--color-neutral-100)',
    gray200: 'var(--color-neutral-200)',
    gray300: 'var(--color-neutral-300)',
    gray400: 'var(--color-neutral-400)',
    gray500: 'var(--color-neutral-500)',
    gray600: 'var(--color-neutral-600)',
    gray700: 'var(--color-neutral-700)',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.03)',
    bgHover: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.15)',
  },
};

// Animated Background
const AnimatedBackground = () => (
  <div
    className="fixed inset-0 overflow-hidden"
    style={{
      background: `radial-gradient(ellipse at 50% 0%, ${tokens.colors.voidOverlay} 0%, ${tokens.colors.voidDeep} 50%, ${tokens.colors.voidPure} 100%)`,
      zIndex: 0,
    }}
  >
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full blur-3xl"
        style={{
          width: `${150 + i * 50}px`,
          height: `${150 + i * 50}px`,
          background: `radial-gradient(circle, ${
            i % 2 === 0 ? tokens.colors.primary500 : tokens.colors.accent500
          }15 0%, transparent 70%)`,
          left: `${10 + i * 20}%`,
          top: `${20 + (i % 3) * 25}%`,
          animation: `float-${i} ${15 + i * 2}s ease-in-out infinite`,
        }}
      />
    ))}
    <style>{`
      @keyframes float-0 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -20px); } }
      @keyframes float-1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-20px, 30px); } }
      @keyframes float-2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(25px, 25px); } }
      @keyframes float-3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, -15px); } }
      @keyframes float-4 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(15px, -30px); } }
    `}</style>
  </div>
);

// Glass Card
const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`rounded-3xl ${className}`}
    style={{
      background: tokens.glass.bg,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${tokens.glass.border}`,
      boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
    }}
  >
    {children}
  </div>
);

// OTP Input Component
const OTPInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  length?: number;
}> = ({ value, onChange, error, length = 6 }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));

  useEffect(() => {
    const newDigits = value.split('').concat(Array(length).fill('')).slice(0, length);
    setDigits(newDigits);
  }, [value, length]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newDigits = [...digits];
    newDigits[index] = val.slice(-1);
    setDigits(newDigits);
    onChange(newDigits.join(''));

    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    const newDigits = pasted.split('').concat(Array(length).fill('')).slice(0, length);
    setDigits(newDigits);
    onChange(newDigits.join(''));
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="text-center font-semibold font-mono outline-none transition-all"
          style={{
            width: '48px',
            height: '56px',
            fontSize: '22px',
            background: tokens.glass.bg,
            border: `2px solid ${
              error ? tokens.colors.danger : digit ? tokens.colors.primary500 : tokens.glass.border
            }`,
            borderRadius: '12px',
            color: tokens.colors.gray100,
          }}
        />
      ))}
    </div>
  );
};

// Step indicator
const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({
  currentStep,
  totalSteps,
}) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <div
        key={i}
        className="transition-all duration-300"
        style={{
          width: i === currentStep ? '24px' : '8px',
          height: '8px',
          borderRadius: '4px',
          background: i <= currentStep ? tokens.colors.primary500 : tokens.glass.border,
        }}
      />
    ))}
  </div>
);

export const MfaSetup: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [step, setStep] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  // Step 1: Initialize MFA setup
  useEffect(() => {
    const initMfa = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/identity/auth/mfa/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to initialize MFA setup');
        }

        const data = await response.json();
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setBackupCodes(data.backupCodes || []);
      } catch (err) {
        setError('Failed to initialize MFA setup. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initMfa();
  }, []);

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackupCodes(true);
        setTimeout(() => setCopiedBackupCodes(false), 2000);
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/identity/auth/mfa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid verification code');
      }

      // Move to backup codes step
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setVerificationCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    navigate('/settings/security');
  };

  const downloadBackupCodes = () => {
    const content = `HubbleWave MFA Backup Codes
Generated: ${new Date().toISOString()}
User: ${auth.user?.email || 'Unknown'}

IMPORTANT: Store these codes in a safe place. Each code can only be used once.

${backupCodes.join('\n')}

If you lose access to your authenticator app, you can use one of these codes to sign in.
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hubblewave-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render step content
  const renderStep0 = () => (
    <div className="p-8 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
        style={{ background: `${tokens.colors.primary500}20` }}
      >
        <Shield size={32} style={{ color: tokens.colors.primary400 }} />
      </div>

      <h1 className="text-2xl font-bold mb-3" style={{ color: tokens.colors.gray100 }}>
        Secure Your Account
      </h1>
      <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
        Two-factor authentication adds an extra layer of security to your account.
        You'll need your phone to sign in.
      </p>

      <div className="space-y-4 mb-8 text-left">
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: tokens.glass.bgHover }}>
          <Smartphone size={20} style={{ color: tokens.colors.accent400, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: tokens.colors.gray200 }}>
              Download an authenticator app
            </p>
            <p className="text-xs mt-1" style={{ color: tokens.colors.gray500 }}>
              Google Authenticator, Microsoft Authenticator, or Authy
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: tokens.glass.bgHover }}>
          <Key size={20} style={{ color: tokens.colors.accent400, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: tokens.colors.gray200 }}>
              Scan QR code or enter secret key
            </p>
            <p className="text-xs mt-1" style={{ color: tokens.colors.gray500 }}>
              Link your authenticator app to your HubbleWave account
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep(1)}
        className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
          boxShadow: `0 4px 20px ${tokens.colors.primary500}30`,
        }}
      >
        Get Started
        <ArrowRight size={18} />
      </button>

      <button
        onClick={() => navigate(-1)}
        className="mt-4 text-sm font-medium"
        style={{ color: tokens.colors.gray500 }}
      >
        I'll do this later
      </button>
    </div>
  );

  const renderStep1 = () => (
    <div className="p-8">
      <StepIndicator currentStep={1} totalSteps={3} />

      <h1 className="text-xl font-bold mb-2 text-center" style={{ color: tokens.colors.gray100 }}>
        Scan QR Code
      </h1>
      <p className="text-sm mb-6 text-center" style={{ color: tokens.colors.gray400 }}>
        Open your authenticator app and scan this code
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin" style={{ color: tokens.colors.primary400 }} />
        </div>
      ) : (
        <>
          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-white">
              {qrCode && (
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
              )}
            </div>
          </div>

          {/* Manual entry option */}
          <div className="mb-6">
            <p className="text-xs text-center mb-2" style={{ color: tokens.colors.gray500 }}>
              Can't scan? Enter this code manually:
            </p>
            <div
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: tokens.glass.bgHover }}
            >
              <code className="text-sm font-mono" style={{ color: tokens.colors.gray200 }}>
                {secret}
              </code>
              <button
                onClick={() => copyToClipboard(secret, 'secret')}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: copiedSecret ? `${tokens.colors.success}20` : 'transparent' }}
              >
                {copiedSecret ? (
                  <CheckCircle size={16} style={{ color: tokens.colors.success }} />
                ) : (
                  <Copy size={16} style={{ color: tokens.colors.gray400 }} />
                )}
              </button>
            </div>
          </div>

          {/* Verification code input */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3 text-center" style={{ color: tokens.colors.gray300 }}>
              Enter the 6-digit code from your app
            </p>
            <OTPInput
              value={verificationCode}
              onChange={setVerificationCode}
              error={!!error}
            />
            {error && (
              <p className="text-sm text-center mt-3 flex items-center justify-center gap-1" style={{ color: tokens.colors.danger }}>
                <AlertCircle size={14} />
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={isLoading || verificationCode.length !== 6}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
              boxShadow: `0 4px 20px ${tokens.colors.primary500}30`,
              opacity: isLoading || verificationCode.length !== 6 ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify & Continue
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            onClick={() => setStep(0)}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm"
            style={{ color: tokens.colors.gray500 }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="p-8">
      <StepIndicator currentStep={2} totalSteps={3} />

      <div
        className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
        style={{ background: `${tokens.colors.success}20` }}
      >
        <CheckCircle size={28} style={{ color: tokens.colors.success }} />
      </div>

      <h1 className="text-xl font-bold mb-2 text-center" style={{ color: tokens.colors.gray100 }}>
        Save Backup Codes
      </h1>
      <p className="text-sm mb-6 text-center" style={{ color: tokens.colors.gray400 }}>
        Store these codes in a safe place. You can use them to sign in if you lose access to your authenticator app.
      </p>

      {/* Backup codes grid */}
      <div
        className="grid grid-cols-2 gap-2 p-4 rounded-xl mb-4"
        style={{ background: tokens.glass.bgHover }}
      >
        {backupCodes.map((code, i) => (
          <div
            key={i}
            className="py-2 px-3 rounded-lg text-center font-mono text-sm"
            style={{ background: tokens.glass.bg, color: tokens.colors.gray200 }}
          >
            {code}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
          className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
          style={{
            background: tokens.glass.bg,
            border: `1px solid ${tokens.glass.border}`,
            color: tokens.colors.gray200,
          }}
        >
          {copiedBackupCodes ? (
            <>
              <CheckCircle size={16} style={{ color: tokens.colors.success }} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} />
              Copy
            </>
          )}
        </button>
        <button
          onClick={downloadBackupCodes}
          className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
          style={{
            background: tokens.glass.bg,
            border: `1px solid ${tokens.glass.border}`,
            color: tokens.colors.gray200,
          }}
        >
          <Download size={16} />
          Download
        </button>
      </div>

      <div
        className="flex items-start gap-2 p-3 rounded-xl mb-6 text-xs"
        style={{
          background: `${tokens.colors.warning}10`,
          border: `1px solid ${tokens.colors.warning}30`,
          color: tokens.colors.warning,
        }}
      >
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>Each backup code can only be used once. Keep them secure and don't share them.</span>
      </div>

      <button
        onClick={handleComplete}
        className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
          boxShadow: `0 4px 20px ${tokens.colors.primary500}30`,
        }}
      >
        Complete Setup
        <CheckCircle size={18} />
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen font-sans flex items-center justify-center p-5"
      style={{ color: tokens.colors.gray100 }}
    >
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-md">
        <GlassCard>
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </GlassCard>

        <p className="text-center text-xs mt-6" style={{ color: tokens.colors.gray500 }}>
          &copy; {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default MfaSetup;
