import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, Lock, CheckCircle, XCircle, ArrowLeft, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';

// Design tokens matching Login page - using CSS variables for theme consistency
const tokens = {
  colors: {
    voidPure: '#000000',
    voidDeep: '#030308',
    voidOverlay: '#1e1e2e',
    // Use CSS variables for theme-aware colors
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

// Password strength requirements
interface PasswordRequirement {
  label: string;
  met: boolean;
}

const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const requirements: PasswordRequirement[] = [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains number', met: /\d/.test(password) },
    { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const strength = metCount === 5 ? 'Strong' : metCount >= 3 ? 'Medium' : 'Weak';
  const strengthColor =
    strength === 'Strong'
      ? 'var(--color-success-500)'
      : strength === 'Medium'
      ? 'var(--color-warning-500)'
      : 'var(--color-danger-500)';

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: tokens.glass.bg }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(metCount / 5) * 100}%`,
              background: strengthColor,
            }}
          />
        </div>
        <span className="text-xs font-medium" style={{ color: strengthColor }}>
          {strength}
        </span>
      </div>

      {/* Requirements list */}
      <div className="space-y-1">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <CheckCircle size={12} style={{ color: 'var(--color-success-500)' }} />
            ) : (
              <XCircle size={12} style={{ color: 'var(--color-neutral-500)' }} />
            )}
            <span style={{ color: req.met ? 'var(--color-success-500)' : 'var(--color-neutral-500)' }}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [view, setView] = useState<'loading' | 'form' | 'success' | 'error' | 'expired'>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setView('error');
      setError('Invalid password reset link. Please request a new one.');
      return;
    }

    // Validate token with backend
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/identity/auth/password-reset/validate?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          if (data.code === 'TOKEN_EXPIRED') {
            setView('expired');
          } else {
            setView('error');
            setError(data.message || 'Invalid password reset link.');
          }
          return;
        }

        setView('form');
      } catch {
        setView('error');
        setError('Unable to validate reset link. Please try again.');
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const hasMinLength = password.length >= 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setError('Password does not meet all requirements');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/identity/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'TOKEN_EXPIRED') {
          setView('expired');
        } else {
          throw new Error(data.message || 'Failed to reset password');
        }
        return;
      }

      setView('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render different views
  const renderLoading = () => (
    <div className="p-10 text-center">
      <Loader2 size={48} className="mx-auto animate-spin" style={{ color: tokens.colors.primary400 }} />
      <p className="mt-4 text-sm" style={{ color: tokens.colors.gray400 }}>
        Validating your reset link...
      </p>
    </div>
  );

  const renderError = () => (
    <div className="p-10 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
        style={{ background: `${tokens.colors.danger}20` }}
      >
        <XCircle size={32} style={{ color: tokens.colors.danger }} />
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: tokens.colors.gray100 }}>
        Invalid Link
      </h1>
      <p className="text-sm mb-6" style={{ color: tokens.colors.gray400 }}>
        {error}
      </p>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: tokens.colors.primary400 }}
      >
        <ArrowLeft size={16} />
        Back to login
      </Link>
    </div>
  );

  const renderExpired = () => (
    <div className="p-10 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
        style={{ background: `${tokens.colors.warning}20` }}
      >
        <AlertCircle size={32} style={{ color: tokens.colors.warning }} />
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: tokens.colors.gray100 }}>
        Link Expired
      </h1>
      <p className="text-sm mb-6" style={{ color: tokens.colors.gray400 }}>
        This password reset link has expired. Please request a new one.
      </p>
      <Link
        to="/login"
        className="inline-block w-full py-3.5 rounded-xl font-semibold text-white text-center transition-all"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
        }}
      >
        Request New Link
      </Link>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-10 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
        style={{ background: `${tokens.colors.success}20` }}
      >
        <CheckCircle size={32} style={{ color: tokens.colors.success }} />
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: tokens.colors.gray100 }}>
        Password Updated!
      </h1>
      <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
        Your password has been successfully reset. You can now sign in with your new password.
      </p>
      <button
        onClick={() => navigate('/login')}
        className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
        }}
      >
        Continue to Sign In
      </button>
    </div>
  );

  const renderForm = () => (
    <div className="p-10">
      <div
        className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center"
        style={{ background: `${tokens.colors.primary500}20` }}
      >
        <Shield size={24} style={{ color: tokens.colors.primary400 }} />
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: tokens.colors.gray100 }}>
        Create New Password
      </h1>
      <p className="text-sm mb-8" style={{ color: tokens.colors.gray400 }}>
        Enter a strong password that you haven't used before.
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

      <form onSubmit={handleSubmit}>
        {/* New Password */}
        <div className="mb-5">
          <label
            htmlFor="new-password"
            className="block text-sm font-medium mb-2"
            style={{ color: tokens.colors.gray300 }}
          >
            New Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: tokens.colors.gray500 }}
            />
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
              style={{ color: tokens.colors.gray500 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password && <PasswordStrength password={password} />}
        </div>

        {/* Confirm Password */}
        <div className="mb-6">
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium mb-2"
            style={{ color: tokens.colors.gray300 }}
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: tokens.colors.gray500 }}
            />
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full py-3.5 pl-12 pr-12 rounded-xl outline-none transition-all"
              style={{
                background: tokens.glass.bg,
                border: `1px solid ${password && confirmPassword && password !== confirmPassword ? tokens.colors.danger : tokens.glass.border}`,
                color: tokens.colors.gray100,
                fontSize: '15px',
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
              style={{ color: tokens.colors.gray500 }}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password && confirmPassword && password !== confirmPassword && (
            <p className="mt-2 text-xs" style={{ color: tokens.colors.danger }}>
              Passwords do not match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-accent-500) 100%)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Updating Password...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      <Link
        to="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm"
        style={{ color: tokens.colors.gray500 }}
      >
        <ArrowLeft size={16} />
        Back to sign in
      </Link>
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
          {view === 'loading' && renderLoading()}
          {view === 'form' && renderForm()}
          {view === 'success' && renderSuccess()}
          {view === 'error' && renderError()}
          {view === 'expired' && renderExpired()}
        </GlassCard>

        <p className="text-center text-xs mt-6" style={{ color: tokens.colors.gray500 }}>
          &copy; {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
