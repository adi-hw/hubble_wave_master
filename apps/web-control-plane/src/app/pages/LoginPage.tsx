import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { colors } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string; code?: string };

      if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
        setError('Unable to connect to the server. Please ensure the backend is running on port 3100.');
      } else if (axiosError.response?.data?.message) {
        setError(axiosError.response.data.message);
      } else {
        setError('Invalid email or password. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colors.void.deepest }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl border"
        style={{
          backgroundColor: colors.void.base,
          borderColor: colors.glass.border,
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center font-bold text-white text-xl"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            HW
          </div>
          <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
            HubbleWave Control Plane
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.text.tertiary }}>
            Sign in to manage your platform
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="flex items-start gap-3 p-3 rounded-lg mb-6"
            style={{
              backgroundColor: colors.danger.glow,
              border: `1px solid ${colors.danger.base}`,
            }}
          >
            <AlertCircle size={18} style={{ color: colors.danger.base, flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: colors.danger.base }}>
              {error}
            </p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.text.muted }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="Email"
              className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm outline-none transition-colors"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
            />
          </div>

          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.text.muted }}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
              className="w-full pl-10 pr-12 py-3 rounded-lg border text-sm outline-none transition-colors"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: colors.text.muted }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-lg font-semibold text-white transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Help text */}
        <p className="text-center text-xs mt-8" style={{ color: colors.text.muted }}>
          Contact your administrator for credentials
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
