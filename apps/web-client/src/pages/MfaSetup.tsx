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

// Animated Background
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden z-0 bg-gradient-to-b from-muted via-background to-background">
    <div className="absolute w-36 h-36 rounded-full blur-3xl bg-primary/10 animate-pulse left-[10%] top-[20%]" />
    <div className="absolute w-48 h-48 rounded-full blur-3xl bg-accent/10 animate-pulse left-[30%] top-[45%] [animation-delay:0.5s]" />
    <div className="absolute w-64 h-64 rounded-full blur-3xl bg-primary/10 animate-pulse left-[50%] top-[70%] [animation-delay:1s]" />
    <div className="absolute w-72 h-72 rounded-full blur-3xl bg-accent/10 animate-pulse left-[70%] top-[20%] [animation-delay:1.5s]" />
    <div className="absolute w-80 h-80 rounded-full blur-3xl bg-primary/10 animate-pulse left-[90%] top-[45%] [animation-delay:2s]" />
  </div>
);

// Glass Card
const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`rounded-3xl bg-card/50 backdrop-blur-xl border border-border shadow-2xl ${className}`}
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
          className={`w-12 h-14 text-[22px] text-center font-semibold font-mono outline-none transition-all bg-card/50 rounded-xl text-foreground ${
            error
              ? 'border-2 border-destructive'
              : digit
              ? 'border-2 border-primary'
              : 'border-2 border-border'
          }`}
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
        className={`h-2 rounded transition-all duration-300 ${
          i === currentStep ? 'w-6' : 'w-2'
        } ${i <= currentStep ? 'bg-primary' : 'bg-border'}`}
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
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-primary/20">
        <Shield size={32} className="text-primary" />
      </div>

      <h1 className="text-2xl font-bold mb-3 text-foreground">
        Secure Your Account
      </h1>
      <p className="text-sm mb-8 text-muted-foreground">
        Two-factor authentication adds an extra layer of security to your account.
        You'll need your phone to sign in.
      </p>

      <div className="space-y-4 mb-8 text-left">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
          <Smartphone size={20} className="text-accent-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Download an authenticator app
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Google Authenticator, Microsoft Authenticator, or Authy
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
          <Key size={20} className="text-accent-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Scan QR code or enter secret key
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Link your authenticator app to your HubbleWave account
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep(1)}
        className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
      >
        Get Started
        <ArrowRight size={18} />
      </button>

      <button
        onClick={() => navigate(-1)}
        className="mt-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        I'll do this later
      </button>
    </div>
  );

  const renderStep1 = () => (
    <div className="p-8">
      <StepIndicator currentStep={1} totalSteps={3} />

      <h1 className="text-xl font-bold mb-2 text-center text-foreground">
        Scan QR Code
      </h1>
      <p className="text-sm mb-6 text-center text-muted-foreground">
        Open your authenticator app and scan this code
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-card">
              {qrCode && (
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
              )}
            </div>
          </div>

          {/* Manual entry option */}
          <div className="mb-6">
            <p className="text-xs text-center mb-2 text-muted-foreground">
              Can't scan? Enter this code manually:
            </p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <code className="text-sm font-mono text-foreground">
                {secret}
              </code>
              <button
                onClick={() => copyToClipboard(secret, 'secret')}
                className={`p-1.5 rounded-lg transition-colors ${
                  copiedSecret ? 'bg-success-subtle' : 'hover:bg-muted'
                }`}
              >
                {copiedSecret ? (
                  <CheckCircle size={16} className="text-success-text" />
                ) : (
                  <Copy size={16} className="text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Verification code input */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3 text-center text-foreground">
              Enter the 6-digit code from your app
            </p>
            <OTPInput
              value={verificationCode}
              onChange={setVerificationCode}
              error={!!error}
            />
            {error && (
              <p className="text-sm text-center mt-3 flex items-center justify-center gap-1 text-destructive">
                <AlertCircle size={14} />
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={isLoading || verificationCode.length !== 6}
            className={`w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 ${
              isLoading || verificationCode.length !== 6
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:shadow-xl hover:shadow-primary/40'
            }`}
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
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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

      <div className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center bg-success-subtle">
        <CheckCircle size={28} className="text-success-text" />
      </div>

      <h1 className="text-xl font-bold mb-2 text-center text-foreground">
        Save Backup Codes
      </h1>
      <p className="text-sm mb-6 text-center text-muted-foreground">
        Store these codes in a safe place. You can use them to sign in if you lose access to your authenticator app.
      </p>

      {/* Backup codes grid */}
      <div className="grid grid-cols-2 gap-2 p-4 rounded-xl mb-4 bg-muted/50">
        {backupCodes.map((code, i) => (
          <div
            key={i}
            className="py-2 px-3 rounded-lg text-center font-mono text-sm bg-card/50 text-foreground"
          >
            {code}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
          className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all bg-card/50 border border-border text-foreground hover:bg-muted"
        >
          {copiedBackupCodes ? (
            <>
              <CheckCircle size={16} className="text-success-text" />
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
          className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all bg-card/50 border border-border text-foreground hover:bg-muted"
        >
          <Download size={16} />
          Download
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl mb-6 text-xs bg-warning-subtle border border-warning-border text-warning-text">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>Each backup code can only be used once. Keep them secure and don't share them.</span>
      </div>

      <button
        onClick={handleComplete}
        className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
      >
        Complete Setup
        <CheckCircle size={18} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen font-sans flex items-center justify-center p-5 text-foreground">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-md">
        <GlassCard>
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </GlassCard>

        <p className="text-center text-xs mt-6 text-muted-foreground">
          &copy; {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default MfaSetup;
