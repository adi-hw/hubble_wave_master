import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, Lock, CheckCircle, XCircle, ArrowLeft, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';

// Animated Background - using predefined Tailwind classes for each orb
const AnimatedBackground = () => {
  const orbs = [
    { size: 'w-[150px] h-[150px]', position: 'left-[10%] top-[20%]', color: 'bg-primary', delay: 'delay-0', duration: 'duration-[3000ms]' },
    { size: 'w-[200px] h-[200px]', position: 'left-[30%] top-[45%]', color: 'bg-accent', delay: 'delay-500', duration: 'duration-[4000ms]' },
    { size: 'w-[250px] h-[250px]', position: 'left-[50%] top-[20%]', color: 'bg-primary', delay: 'delay-1000', duration: 'duration-[5000ms]' },
    { size: 'w-[300px] h-[300px]', position: 'left-[70%] top-[45%]', color: 'bg-accent', delay: 'delay-[1500ms]', duration: 'duration-[6000ms]' },
    { size: 'w-[350px] h-[350px]', position: 'left-[90%] top-[20%]', color: 'bg-primary', delay: 'delay-[2000ms]', duration: 'duration-[7000ms]' },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[color:rgb(var(--bg-surface-rgb))] via-[color:rgb(var(--bg-base-rgb))] to-[color:rgb(var(--bg-sunken-rgb))] z-0">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-3xl opacity-10 animate-pulse ${orb.size} ${orb.position} ${orb.color} ${orb.delay} ${orb.duration}`}
        />
      ))}
    </div>
  );
};

// Glass Card
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

  // Map metCount to Tailwind width classes (0-5 requirements = 0%, 20%, 40%, 60%, 80%, 100%)
  const widthClasses = ['w-0', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full'];
  const widthClass = widthClasses[metCount];

  const strengthColorClass =
    strength === 'Strong'
      ? 'bg-success text-success'
      : strength === 'Medium'
      ? 'bg-warning text-warning'
      : 'bg-danger text-danger';

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-card/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${widthClass} ${strengthColorClass.split(' ')[0]}`}
          />
        </div>
        <span className={`text-xs font-medium ${strengthColorClass.split(' ')[1]}`}>
          {strength}
        </span>
      </div>

      {/* Requirements list */}
      <div className="space-y-1">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <CheckCircle size={12} className="text-success" />
            ) : (
              <XCircle size={12} className="text-muted-foreground" />
            )}
            <span className={req.met ? 'text-success' : 'text-muted-foreground'}>
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
      <Loader2 size={48} className="mx-auto animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">
        Validating your reset link...
      </p>
    </div>
  );

  const renderError = () => (
    <div className="p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-danger/20">
        <XCircle size={32} className="text-danger" />
      </div>
      <h1 className="text-2xl font-bold mb-3 text-foreground">
        Invalid Link
      </h1>
      <p className="text-sm mb-6 text-muted-foreground">
        {error}
      </p>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to login
      </Link>
    </div>
  );

  const renderExpired = () => (
    <div className="p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-warning/20">
        <AlertCircle size={32} className="text-warning" />
      </div>
      <h1 className="text-2xl font-bold mb-3 text-foreground">
        Link Expired
      </h1>
      <p className="text-sm mb-6 text-muted-foreground">
        This password reset link has expired. Please request a new one.
      </p>
      <Link
        to="/login"
        className="inline-block w-full py-3.5 rounded-xl font-semibold text-primary-foreground text-center transition-all bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
      >
        Request New Link
      </Link>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-success/20">
        <CheckCircle size={32} className="text-success" />
      </div>
      <h1 className="text-2xl font-bold mb-3 text-foreground">
        Password Updated!
      </h1>
      <p className="text-sm mb-8 text-muted-foreground">
        Your password has been successfully reset. You can now sign in with your new password.
      </p>
      <button
        onClick={() => navigate('/login')}
        className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
      >
        Continue to Sign In
      </button>
    </div>
  );

  const renderForm = () => (
    <div className="p-10">
      <div className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center bg-primary/20">
        <Shield size={24} className="text-primary" />
      </div>

      <h1 className="text-2xl font-bold mb-2 text-foreground">
        Create New Password
      </h1>
      <p className="text-sm mb-8 text-muted-foreground">
        Enter a strong password that you haven't used before.
      </p>

      {error && (
        <div className="p-3 rounded-xl mb-6 flex items-center gap-2 text-sm bg-danger/10 border border-danger/30 text-danger">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* New Password */}
        <div className="mb-5">
          <label
            htmlFor="new-password"
            className="block text-sm font-medium mb-2 text-muted-foreground"
          >
            New Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full py-3.5 pl-12 pr-12 rounded-xl outline-none transition-all bg-card/10 border border-border/40 text-foreground text-[15px] placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
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
            className="block text-sm font-medium mb-2 text-muted-foreground"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className={`w-full py-3.5 pl-12 pr-12 rounded-xl outline-none transition-all bg-card/10 text-foreground text-[15px] placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/50 ${
                password && confirmPassword && password !== confirmPassword
                  ? 'border border-danger'
                  : 'border border-border/40'
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password && confirmPassword && password !== confirmPassword && (
            <p className="mt-2 text-xs text-danger">
              Passwords do not match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
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
        className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back to sign in
      </Link>
    </div>
  );

  return (
    <div className="dark min-h-screen font-sans flex items-center justify-center p-5 text-foreground">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-md">
        <GlassCard>
          {view === 'loading' && renderLoading()}
          {view === 'form' && renderForm()}
          {view === 'success' && renderSuccess()}
          {view === 'error' && renderError()}
          {view === 'expired' && renderExpired()}
        </GlassCard>

        <p className="text-center text-xs mt-6 text-muted-foreground">
          &copy; {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
