import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { setStoredToken } from '../services/token';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const normalizedUsername = username.trim();
      const normalizedPassword = password;
      const data = await authService.login(normalizedUsername, normalizedPassword);
      setStoredToken(data.accessToken);
      await refresh();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Background gradient decoration */}
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--color-primary-500)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--color-accent-500)' }}
        />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div
          className="rounded-2xl px-8 py-10"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
              style={{ background: 'var(--gradient-brand)' }}
            >
              HW
            </div>
            <div>
              <div
                className="font-semibold text-xl"
                style={{ color: 'var(--text-primary)' }}
              >
                HubbleWave
              </div>
              <div
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Envision at your own ease
              </div>
            </div>
          </div>

          {/* Header */}
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Welcome back
          </h1>
          <p
            className="text-sm mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            Sign in to access your workspace and continue where you left off.
          </p>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Username/Email Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email or username
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="input w-full pl-10"
                  placeholder="name@company.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs font-medium transition-colors"
                  style={{ color: 'var(--text-brand)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input w-full pl-10 pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="text-sm text-center p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-danger-subtle)',
                  color: 'var(--text-danger)',
                  border: '1px solid var(--border-danger)',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div
                  className="w-full"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div className="relative flex justify-center text-xs">
                <span
                  className="px-3"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-muted)',
                  }}
                >
                  or continue with
                </span>
              </div>
            </div>

            {/* SSO Button */}
            <button
              type="button"
              className="btn btn-secondary w-full justify-center"
            >
              Sign in with SSO
            </button>
          </form>

          {/* Footer Links */}
          <div
            className="mt-8 pt-6 text-xs flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div style={{ color: 'var(--text-muted)' }}>
              Need access?{' '}
              <button
                className="font-medium transition-colors"
                style={{ color: 'var(--text-brand)' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Contact admin
              </button>
            </div>
            <div
              className="flex gap-4"
              style={{ color: 'var(--text-muted)' }}
            >
              <button
                className="transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Privacy
              </button>
              <button
                className="transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Terms
              </button>
            </div>
          </div>
        </div>

        {/* Version/Copyright */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: 'var(--text-muted)' }}
        >
          © {new Date().getFullYear()} HubbleWave. All rights reserved.
        </p>
      </div>
    </div>
  );
};
