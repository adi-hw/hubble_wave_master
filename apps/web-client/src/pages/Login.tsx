import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, Key, Smartphone, Building2, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { useAuth, LoginCredentials } from '../auth/AuthContext';
import { authService, SsoConfig } from '../services/auth';

// ============================================================================
// Animated Background Component
// Uses Tailwind classes with CSS custom properties for complex gradients
// ============================================================================
const AnimatedBackground = () => (
  <div
    className="fixed inset-0 overflow-hidden z-0 bg-gradient-to-b from-[color:rgb(var(--bg-surface-rgb))] via-[color:rgb(var(--bg-base-rgb))] to-[color:rgb(var(--bg-sunken-rgb))]"
  >
    {/* Floating orbs - require dynamic sizing so kept minimal inline */}
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className={`absolute rounded-full blur-3xl ${i % 2 === 0 ? 'bg-primary/[0.08]' : 'bg-accent/[0.08]'}`}
        style={{
          width: `${150 + i * 50}px`,
          height: `${150 + i * 50}px`,
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
    className={`rounded-3xl bg-card/60 backdrop-blur-xl border border-border/50 shadow-2xl ${className}`}
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
            className={`w-[52px] h-16 text-center font-semibold font-mono text-2xl outline-none transition-all bg-card/10 rounded-xl text-foreground ${
              error
                ? 'border-2 border-destructive'
                : digit
                  ? 'border-2 border-primary'
                  : 'border-2 border-border/40'
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-center mt-3 flex items-center justify-center gap-1 text-destructive">
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
  const [view, setView] = useState<'login' | 'mfa' | 'forgot-password' | 'sso' | 'expired-password' | 'magic-link'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPending, setMfaPending] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkExpiresAt, setMagicLinkExpiresAt] = useState<Date | null>(null);

  const { login, requestPasswordReset, auth } = useAuth();
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

  const handleLogin = async (e: React.FormEvent, mfaToken?: string) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const credentials: LoginCredentials = {
        username: username.trim(),
        password,
        rememberMe,
        mfaToken,
      };

      const result = await login(credentials);

      if (result.mfaRequired) {
        // MFA is required - show MFA input view
        // Backend expects mfaToken in next login request (not separate endpoint)
        setMfaPending(true);
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
    if (!mfaPending) return;

    // Re-call login with the MFA code included
    // Backend expects mfaToken in the login request itself
    await handleLogin(e, mfaCode);
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

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authService.requestMagicLink(magicLinkEmail);
      setMagicLinkSent(true);
      setMagicLinkExpiresAt(result.expiresAt);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to send magic link');
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
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center text-2xl font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent">
          HW
        </div>
        <h1 className="text-2xl font-bold mb-2 text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your HubbleWave account
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm bg-destructive/[0.15] border border-destructive/30 text-destructive">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} autoComplete="on">
        {/* Email field */}
        <div className="mb-5">
          <label
            htmlFor="login-email"
            className="block text-sm font-medium mb-2 text-muted-foreground"
          >
            Email address
          </label>
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              size={18}
            />
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@company.com"
              className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
              required
            />
          </div>
        </div>

        {/* Password field */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="login-password" className="text-sm font-medium text-muted-foreground">
              Password
            </label>
            <button
              type="button"
              onClick={() => setView('forgot-password')}
              className="text-sm font-medium transition-opacity hover:opacity-80 text-primary"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              size={18}
            />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full py-3.5 pl-12 pr-12 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 transition-colors text-muted-foreground/80"
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
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm text-muted-foreground">
              Remember me
            </span>
          </label>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
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
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-sm text-muted-foreground/80">
              or continue with
            </span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* Google/Microsoft SSO Buttons - Only show if configured */}
          {(ssoConfig.googleEnabled || ssoConfig.microsoftEnabled) && (
            <div className={`grid gap-3 mb-6 ${ssoConfig.googleEnabled && ssoConfig.microsoftEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {ssoConfig.googleEnabled && (
                <button
                  type="button"
                  className="py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all bg-card/10 border border-border/40 text-muted-foreground text-sm font-medium"
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold bg-info">
                    G
                  </span>
                  Google
                </button>
              )}
              {ssoConfig.microsoftEnabled && (
                <button
                  type="button"
                  className="py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all bg-card/10 border border-border/40 text-muted-foreground text-sm font-medium"
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold bg-info">
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
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all mb-8 bg-transparent border border-border/40 text-muted-foreground text-sm"
            >
              <Building2 size={18} />
              Sign in with Enterprise SSO
            </button>
          )}
        </>
      )}

      {/* Magic Link Option */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setView('magic-link')}
          className="text-sm flex items-center justify-center gap-2 mx-auto transition-opacity hover:opacity-80 text-muted-foreground"
        >
          <Wand2 size={16} />
          Sign in with magic link instead
        </button>
      </div>
    </div>
  );

  const renderMagicLinkView = () => {
    if (magicLinkSent) {
      return (
        <div className="p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-success-subtle">
            <Mail size={28} className="text-success-text" />
          </div>

          <h1 className="text-2xl font-bold mb-3 text-foreground">
            Check your email
          </h1>
          <p className="text-sm mb-2 text-muted-foreground">
            We've sent a magic link to
          </p>
          <p className="font-medium mb-4 text-muted-foreground">
            {magicLinkEmail}
          </p>
          {magicLinkExpiresAt && (
            <p className="text-xs mb-8 text-muted-foreground/80">
              Link expires in 15 minutes
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setView('login');
              setMagicLinkSent(false);
              setMagicLinkEmail('');
            }}
            className="w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-card/10 border border-border/40 text-muted-foreground"
          >
            Back to sign in
          </button>

          <p className="mt-6 text-sm text-muted-foreground/80">
            Didn't receive the email?{' '}
            <button
              onClick={() => setMagicLinkSent(false)}
              className="font-medium text-primary"
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
          className="flex items-center gap-1.5 text-sm mb-6 text-muted-foreground"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>

        <div className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center bg-card/20">
          <Wand2 size={24} className="text-primary" />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-foreground">
          Sign in with magic link
        </h1>
        <p className="text-sm mb-8 text-muted-foreground">
          Enter your email and we'll send you a secure sign-in link. No password needed.
        </p>

        {error && (
          <div className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm bg-destructive/[0.15] border border-destructive/30 text-destructive">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleMagicLinkRequest}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Email address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                size={18}
              />
              <input
                type="email"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Wand2 size={18} />
                Send magic link
              </>
            )}
          </button>
        </form>
      </div>
    );
  };

  const renderMfaView = () => (
    <div className="p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-primary/20">
        {useBackupCode ? (
          <Key size={28} className="text-primary" />
        ) : (
          <Smartphone size={28} className="text-primary" />
        )}
      </div>

      <h1 className="text-2xl font-bold mb-2 text-foreground">
        {useBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
      </h1>
      <p className="text-sm mb-8 text-muted-foreground">
        {useBackupCode
          ? 'Enter one of your backup codes to sign in'
          : 'Enter the 6-digit code from your authenticator app'}
      </p>

      {error && (
        <div className="p-3 rounded-xl mb-6 flex items-center justify-center gap-2 text-sm bg-destructive/[0.15] border border-destructive/30 text-destructive">
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
            className="w-full py-3.5 px-4 rounded-xl outline-none transition-all text-center font-mono mb-6 bg-card/10 border border-border/40 text-foreground text-lg tracking-widest"
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
          className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
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
        className="mt-5 text-sm font-medium text-primary"
      >
        {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
      </button>

      <button
        type="button"
        onClick={() => {
          setView('login');
          setMfaCode('');
          setMfaPending(false);
          setError('');
        }}
        className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground/80"
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
          <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-success-subtle">
            <Mail size={28} className="text-success-text" />
          </div>

          <h1 className="text-2xl font-bold mb-3 text-foreground">
            Check your email
          </h1>
          <p className="text-sm mb-2 text-muted-foreground">
            We've sent a password reset link to
          </p>
          <p className="font-medium mb-8 text-muted-foreground">
            {forgotPasswordEmail}
          </p>

          <button
            type="button"
            onClick={() => {
              setView('login');
              setForgotPasswordSent(false);
              setForgotPasswordEmail('');
            }}
            className="w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-card/10 border border-border/40 text-muted-foreground"
          >
            Back to sign in
          </button>

          <p className="mt-6 text-sm text-muted-foreground/80">
            Didn't receive the email?{' '}
            <button
              onClick={() => setForgotPasswordSent(false)}
              className="font-medium text-primary"
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
          className="flex items-center gap-1.5 text-sm mb-6 text-muted-foreground"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>

        <div className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center bg-card/20">
          <Key size={24} className="text-primary" />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-foreground">
          Forgot your password?
        </h1>
        <p className="text-sm mb-8 text-muted-foreground">
          No worries! Enter your email and we'll send you a reset link.
        </p>

        {error && (
          <div className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm bg-destructive/[0.15] border border-destructive/30 text-destructive">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleForgotPassword}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Email address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                size={18}
              />
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
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
        className="flex items-center gap-1.5 text-sm mb-6 text-muted-foreground"
      >
        <ArrowLeft size={16} />
        Back to sign in
      </button>

      <div className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center bg-card/20">
        <Building2 size={24} className="text-primary" />
      </div>

      <h1 className="text-2xl font-bold mb-2 text-foreground">
        Enterprise SSO
      </h1>
      <p className="text-sm mb-8 text-muted-foreground">
        Enter your work email to continue with your organization's SSO provider
      </p>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Work email
          </label>
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              size={18}
            />
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
        >
          Continue with SSO
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl transition-all bg-accent border border-[color:rgb(var(--border-accent-rgb)/0.35)] text-accent-foreground"
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
          <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-success-subtle">
            <Lock size={28} className="text-success-text" />
          </div>
          <h1 className="text-2xl font-bold mb-3 text-foreground">
            Password Changed!
          </h1>
          <p className="text-sm text-muted-foreground">
            Your password has been updated. Redirecting to login...
          </p>
        </div>
      );
    }

    return (
      <div className="p-10">
        <div className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center bg-warning-subtle">
          <AlertCircle size={24} className="text-warning-text" />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-foreground">
          Password Expired
        </h1>
        <p className="text-sm mb-8 text-muted-foreground">
          Your password has expired. Please create a new password to continue.
        </p>

        {error && (
          <div className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm bg-destructive/[0.15] border border-destructive/30 text-destructive">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleExpiredPasswordChange}>
          {/* New Password */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              New Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                size={18}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
                required
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                size={18}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px]"
                required
              />
            </div>
          </div>

          {/* Password requirements */}
          <div className="mb-6 text-xs text-muted-foreground/80">
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
            className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
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
          className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground/80"
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
    <div className="dark min-h-screen font-sans flex items-center justify-center p-5 text-foreground">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-md">
        <GlassCard>
          {view === 'login' && renderLoginView()}
          {view === 'magic-link' && renderMagicLinkView()}
          {view === 'mfa' && renderMfaView()}
          {view === 'forgot-password' && renderForgotPasswordView()}
          {view === 'sso' && renderSsoView()}
          {view === 'expired-password' && renderExpiredPasswordView()}
        </GlassCard>

        {/* Version/Copyright */}
        <p className="text-center text-xs mt-6 text-muted-foreground/80">
          &copy; {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};
