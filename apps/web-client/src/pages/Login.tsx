import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { setStoredToken } from '../services/token';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      // SECURITY: Refresh token is set as HttpOnly cookie by backend
      // Do NOT store in localStorage to prevent XSS token theft
      await refresh();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-300/40 border border-slate-200 px-8 py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-semibold">
              HW
            </div>
            <div>
              <div className="text-slate-900 font-semibold text-lg">HubbleWave</div>
              <div className="text-slate-500 text-sm">Envision At Your Own Ease</div>
            </div>
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">
            Use your work credentials to access equipment, inventory, and maintenance data.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Email or username
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full rounded-lg border border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                  placeholder="name@hospital.org"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <span className="text-xs text-slate-400">Min. 8 characters</span>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-lg border border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-rose-600 text-sm text-center bg-rose-50 p-2 rounded-lg border border-rose-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex justify-center items-center gap-2 rounded-lg bg-sky-700 text-white text-sm font-semibold py-2.5 hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-100 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
            </button>

            <button
              type="button"
              className="w-full inline-flex justify-center items-center rounded-lg bg-sky-50 text-sky-700 text-sm font-semibold py-2.5 hover:bg-sky-100 border border-sky-100 transition"
            >
              Sign in with SSO
            </button>
          </form>

          <div className="mt-6 text-xs text-slate-500 flex items-center justify-between">
            <div>
              Need access?{' '}
              <button className="text-sky-600 hover:text-sky-700 font-medium">Contact admin</button>
            </div>
            <div className="flex gap-4">
              <button className="hover:text-slate-700">Privacy</button>
              <button className="hover:text-slate-700">Terms</button>
              <button className="hover:text-slate-700">Support</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
