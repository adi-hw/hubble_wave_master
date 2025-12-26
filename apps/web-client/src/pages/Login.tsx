import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, Key, Smartphone, Building2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth, LoginCredentials } from '../auth/AuthContext';
import { authService, SsoConfig } from '../services/auth';

// ============================================================================
// Design Tokens - Using CSS variables from design-tokens.css
// The login page uses a dark theme with glassmorphic effects
// ============================================================================
const tokens = {
  colors: {
    // Void/dark backgrounds - unique to login page aesthetic
    voidPure: '#000000',
    voidDeep: '#030308',
    voidOverlay: '#1e1e2e',
    // All other colors reference CSS variables
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
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.03)',
    bgHover: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.15)',
  },
};

// ============================================================================
// Animated Background Component
// ============================================================================
const AnimatedBackground = () => (
  <div
    className="fixed inset-0 overflow-hidden"
    style={{
      background: `radial-gradient(ellipse at 50% 0%, ${tokens.colors.voidOverlay} 0%, ${tokens.colors.voidDeep} 50%, ${tokens.colors.voidPure} 100%)`,
      zIndex: 0,
    }}
  >
    {/* Floating orbs */}
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

// ============================================================================
// Glass Card Component
// ============================================================================
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

// ============================================================================
// OTP Input Component
// ============================================================================
const OTPInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  error?: string;
  length?: number;
}> = ({ value, onChange, error, length = 6 }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));

  useEffect(() => {
    // Sync external value
    const newDigits = value.split('').concat(Array(length).fill('')).slice(0, length);
    setDigits(newDigits);
  }, [value, length]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newDigits = [...digits];
    newDigits[index] = val.slice(-1);
    setDigits(newDigits);
    onChange(newDigits.join(''));

    // Auto-focus next input
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
    <div>
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
              width: '52px',
              height: '64px',
              fontSize: '24px',
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
      {error && (
        <p
          className="text-sm text-center mt-3 flex items-center justify-center gap-1"
          style={{ color: tokens.colors.danger }}
        >
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Main Login Component
// ============================================================================
export const Login = () => {
  const [view, setView] = useState<'login' | 'mfa' | 'forgot-password' | 'sso' | 'expired-password'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  const { login, verifyMfa, requestPasswordReset, auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch SSO configuration on mount
  useEffect(() => {
    authService.getSsoConfig().then(setSsoConfig).catch(() => {
      // If failed, set empty config (SSO disabled)
      setSsoConfig({
        enabled: false,
        googleEnabled: false,
        microsoftEnabled: false,
        samlEnabled: false,
        oidcEnabled: false,
        enterpriseSsoEnabled: false,
        providers: [],
      });
    });
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (auth.isAuthenticated && !auth.loading) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [auth.isAuthenticated, auth.loading, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const credentials: LoginCredentials = {
        username: username.trim(),
        password,
        rememberMe,
      };

      const result = await login(credentials);

      if (result.mfaRequired && result.mfaSessionToken) {
        setMfaSessionToken(result.mfaSessionToken);
        setView('mfa');
      } else if (result.passwordExpired) {
        // Password has expired, show the change password view
        setView('expired-password');
        setError('');
      } else if (result.success) {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSessionToken) return;

    setError('');
    setIsLoading(true);

    try {
      await verifyMfa({
        code: mfaCode,
        mfaSessionToken,
        useBackupCode,
      });
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'MFA verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await requestPasswordReset(forgotPasswordEmail);
      setForgotPasswordSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // Render Views
  // =========================================================================

  const renderLoginView = () => (
    <div className="p-10">
      {/* Logo & Header */}
      <div className="text-center mb-10">
        <div
          className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${tokens.colors.primary500}, ${tokens.colors.accent500})`,
          }}
        >
          HW
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.colors.gray100 }}>
          Welcome back
        </h1>
        <p className="text-sm" style={{ color: tokens.colors.gray400 }}>
          Sign in to your HubbleWave account
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm"
          style={{
            background: `${tokens.colors.danger}15`,
            border: `1px solid ${tokens.colors.danger}30`,
            color: tokens.colors.danger,
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} autoComplete="on">
        {/* Email field */}
        <div className="mb-5">
          <label
            htmlFor="login-email"
            className="block text-sm font-medium mb-2"
            style={{ color: tokens.colors.gray300 }}
          >
            Email address
          </label>
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: tokens.colors.gray500 }}
            />
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@company.com"
              className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all"
              style={{
                background: tokens.glass.bg,
                border: `1px solid ${tokens.glass.border}`,
                color: tokens.colors.gray100,
                fontSize: '15px',
              }}
              required
            />
          </div>
        </div>

        {/* Password field */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="login-password" className="text-sm font-medium" style={{ color: tokens.colors.gray300 }}>
              Password
            </label>
            <button
              type="button"
              onClick={() => setView('forgot-password')}
              className="text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: tokens.colors.primary400 }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: tokens.colors.gray500 }}
            />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full py-3.5 pl-12 pr-12 rounded-xl outline-none transition-all"
              style={{
                background: tokens.glass.bg,
                border: `1px solid ${tokens.glass.border}`,
                color: tokens.colors.gray100,
                fontSize: '15px',
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 transition-colors"
              style={{ color: tokens.colors.gray500 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center justify-between mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: tokens.colors.primary500 }}
            />
            <span className="text-sm" style={{ color: tokens.colors.gray400 }}>
              Remember me
            </span>
          </label>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* SSO Options - Only show if any SSO is configured */}
      {ssoConfig && (ssoConfig.googleEnabled || ssoConfig.microsoftEnabled || ssoConfig.enterpriseSsoEnabled) && (
        <>
          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px" style={{ background: tokens.glass.border }} />
            <span className="text-sm" style={{ color: tokens.colors.gray500 }}>
              or continue with
            </span>
            <div className="flex-1 h-px" style={{ background: tokens.glass.border }} />
          </div>

          {/* Google/Microsoft SSO Buttons - Only show if configured */}
          {(ssoConfig.googleEnabled || ssoConfig.microsoftEnabled) && (
            <div className={`grid gap-3 mb-6 ${ssoConfig.googleEnabled && ssoConfig.microsoftEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {ssoConfig.googleEnabled && (
                <button
                  type="button"
                  className="py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: tokens.glass.bg,
                    border: `1px solid ${tokens.glass.border}`,
                    color: tokens.colors.gray200,
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: '#4285f4' }}
                  >
                    G
                  </span>
                  Google
                </button>
              )}
              {ssoConfig.microsoftEnabled && (
                <button
                  type="button"
                  className="py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: tokens.glass.bg,
                    border: `1px solid ${tokens.glass.border}`,
                    color: tokens.colors.gray200,
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: '#00a4ef' }}
                  >
                    M
                  </span>
                  Microsoft
                </button>
              )}
            </div>
          )}

          {/* Enterprise SSO - Only show if configured */}
          {ssoConfig.enterpriseSsoEnabled && (
            <button
              type="button"
              onClick={() => setView('sso')}
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all mb-8"
              style={{
                background: 'transparent',
                border: `1px solid ${tokens.glass.border}`,
                color: tokens.colors.gray300,
                fontSize: '14px',
              }}
            >
              <Building2 size={18} />
              Sign in with Enterprise SSO
            </button>
          )}
        </>
      )}

      {/* Contact admin */}
      <p className="text-center text-sm mt-8" style={{ color: tokens.colors.gray400 }}>
        Need access?{' '}
        <button className="font-semibold" style={{ color: tokens.colors.primary400 }}>
          Contact admin
        </button>
      </p>
    </div>
  );

  const renderMfaView = () => (
    <div className="p-10 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
        style={{ background: `${tokens.colors.primary500}20` }}
      >
        {useBackupCode ? (
          <Key size={28} style={{ color: tokens.colors.primary400 }} />
        ) : (
          <Smartphone size={28} style={{ color: tokens.colors.primary400 }} />
        )}
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.colors.gray100 }}>
        {useBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
      </h1>
      <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
        {useBackupCode
          ? 'Enter one of your backup codes to sign in'
          : 'Enter the 6-digit code from your authenticator app'}
      </p>

      {error && (
        <div
          className="p-3 rounded-xl mb-6 flex items-center justify-center gap-2 text-sm"
          style={{
            background: `${tokens.colors.danger}15`,
            border: `1px solid ${tokens.colors.danger}30`,
            color: tokens.colors.danger,
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleMfaVerify}>
        {useBackupCode ? (
          <input
            type="text"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            className="w-full py-3.5 px-4 rounded-xl outline-none transition-all text-center font-mono mb-6"
            style={{
              background: tokens.glass.bg,
              border: `1px solid ${tokens.glass.border}`,
              color: tokens.colors.gray100,
              fontSize: '18px',
              letterSpacing: '2px',
            }}
            required
          />
        ) : (
          <div className="mb-6">
            <OTPInput value={mfaCode} onChange={setMfaCode} />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || mfaCode.length < (useBackupCode ? 10 : 6)}
          className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseBackupCode(!useBackupCode);
          setMfaCode('');
          setError('');
        }}
        className="mt-5 text-sm font-medium"
        style={{ color: tokens.colors.primary400 }}
      >
        {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
      </button>

      <button
        type="button"
        onClick={() => {
          setView('login');
          setMfaCode('');
          setError('');
        }}
        className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm"
        style={{ color: tokens.colors.gray500 }}
      >
        <ArrowLeft size={16} />
        Back to sign in
      </button>
    </div>
  );

  const renderForgotPasswordView = () => {
    if (forgotPasswordSent) {
      return (
        <div className="p-10 text-center">
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: `${tokens.colors.success}20` }}
          >
            <Mail size={28} style={{ color: tokens.colors.success }} />
          </div>

          <h1 className="text-2xl font-bold mb-3" style={{ color: tokens.colors.gray100 }}>
            Check your email
          </h1>
          <p className="text-sm mb-2" style={{ color: tokens.colors.gray400 }}>
            We've sent a password reset link to
          </p>
          <p className="font-medium mb-8" style={{ color: tokens.colors.gray200 }}>
            {forgotPasswordEmail}
          </p>

          <button
            type="button"
            onClick={() => {
              setView('login');
              setForgotPasswordSent(false);
              setForgotPasswordEmail('');
            }}
            className="w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              background: tokens.glass.bg,
              border: `1px solid ${tokens.glass.border}`,
              color: tokens.colors.gray200,
            }}
          >
            Back to sign in
          </button>

          <p className="mt-6 text-sm" style={{ color: tokens.colors.gray500 }}>
            Didn't receive the email?{' '}
            <button
              onClick={() => setForgotPasswordSent(false)}
              className="font-medium"
              style={{ color: tokens.colors.primary400 }}
            >
              Try again
            </button>
          </p>
        </div>
      );
    }

    return (
      <div className="p-10">
        <button
          type="button"
          onClick={() => setView('login')}
          className="flex items-center gap-1.5 text-sm mb-6"
          style={{ color: tokens.colors.gray400 }}
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>

        <div
          className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center"
          style={{ background: tokens.glass.bgHover }}
        >
          <Key size={24} style={{ color: tokens.colors.primary400 }} />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.colors.gray100 }}>
          Forgot your password?
        </h1>
        <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
          No worries! Enter your email and we'll send you a reset link.
        </p>

        {error && (
          <div
            className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm"
            style={{
              background: `${tokens.colors.danger}15`,
              border: `1px solid ${tokens.colors.danger}30`,
              color: tokens.colors.danger,
            }}
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleForgotPassword}>
          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: tokens.colors.gray300 }}
            >
              Email address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2"
                size={18}
                style={{ color: tokens.colors.gray500 }}
              />
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all"
                style={{
                  background: tokens.glass.bg,
                  border: `1px solid ${tokens.glass.border}`,
                  color: tokens.colors.gray100,
                  fontSize: '15px',
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      </div>
    );
  };

  const renderSsoView = () => (
    <div className="p-10">
      <button
        type="button"
        onClick={() => setView('login')}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: tokens.colors.gray400 }}
      >
        <ArrowLeft size={16} />
        Back to sign in
      </button>

      <div
        className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center"
        style={{ background: tokens.glass.bgHover }}
      >
        <Building2 size={24} style={{ color: tokens.colors.primary400 }} />
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.colors.gray100 }}>
        Enterprise SSO
      </h1>
      <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
        Enter your work email to continue with your organization's SSO provider
      </p>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="mb-6">
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: tokens.colors.gray300 }}
          >
            Work email
          </label>
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: tokens.colors.gray500 }}
            />
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all"
              style={{
                background: tokens.glass.bg,
                border: `1px solid ${tokens.glass.border}`,
                color: tokens.colors.gray100,
                fontSize: '15px',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
          }}
        >
          Continue with SSO
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl transition-all"
          style={{
            background: `${tokens.colors.accent500}15`,
            border: `1px solid ${tokens.colors.accent500}30`,
            color: tokens.colors.accent400,
          }}
        >
          <Sparkles size={16} />
          Not sure if your organization uses SSO? Ask AVA
        </button>
      </div>
    </div>
  );

  const handleExpiredPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    setIsLoading(true);

    try {
      // We need to use the current password (which is still valid for changing)
      // and the new password to reset it
      const response = await fetch('/api/identity/auth/change-password-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          currentPassword: password,
          newPassword: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setPasswordChangeSuccess(true);
      // After 2 seconds, redirect back to login
      setTimeout(() => {
        setView('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordChangeSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const renderExpiredPasswordView = () => {
    if (passwordChangeSuccess) {
      return (
        <div className="p-10 text-center">
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: `${tokens.colors.success}20` }}
          >
            <Lock size={28} style={{ color: tokens.colors.success }} />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: tokens.colors.gray100 }}>
            Password Changed!
          </h1>
          <p className="text-sm" style={{ color: tokens.colors.gray400 }}>
            Your password has been updated. Redirecting to login...
          </p>
        </div>
      );
    }

    return (
      <div className="p-10">
        <div
          className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center"
          style={{ background: `${tokens.colors.warning}20` }}
        >
          <AlertCircle size={24} style={{ color: tokens.colors.warning }} />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.colors.gray100 }}>
          Password Expired
        </h1>
        <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
          Your password has expired. Please create a new password to continue.
        </p>

        {error && (
          <div
            className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm"
            style={{
              background: `${tokens.colors.danger}15`,
              border: `1px solid ${tokens.colors.danger}30`,
              color: tokens.colors.danger,
            }}
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleExpiredPasswordChange}>
          {/* New Password */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.gray300 }}>
              New Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2"
                size={18}
                style={{ color: tokens.colors.gray500 }}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all"
                style={{
                  background: tokens.glass.bg,
                  border: `1px solid ${tokens.glass.border}`,
                  color: tokens.colors.gray100,
                  fontSize: '15px',
                }}
                required
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.gray300 }}>
              Confirm New Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2"
                size={18}
                style={{ color: tokens.colors.gray500 }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all"
                style={{
                  background: tokens.glass.bg,
                  border: `1px solid ${tokens.glass.border}`,
                  color: tokens.colors.gray100,
                  fontSize: '15px',
                }}
                required
              />
            </div>
          </div>

          {/* Password requirements */}
          <div className="mb-6 text-xs" style={{ color: tokens.colors.gray500 }}>
            <p>Password must:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Be at least 12 characters long</li>
              <li>Include uppercase and lowercase letters</li>
              <li>Include at least one number</li>
              <li>Include at least one special character</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setView('login');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
          }}
          className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm"
          style={{ color: tokens.colors.gray500 }}
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>
      </div>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================

  return (
    <div
      className="min-h-screen font-sans flex items-center justify-center p-5"
      style={{ color: tokens.colors.gray100 }}
    >
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-md">
        <GlassCard>
          {view === 'login' && renderLoginView()}
          {view === 'mfa' && renderMfaView()}
          {view === 'forgot-password' && renderForgotPasswordView()}
          {view === 'sso' && renderSsoView()}
          {view === 'expired-password' && renderExpiredPasswordView()}
        </GlassCard>

        {/* Version/Copyright */}
        <p className="text-center text-xs mt-6" style={{ color: tokens.colors.gray500 }}>
          © {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};
