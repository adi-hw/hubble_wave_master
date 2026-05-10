import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService, AuthRole, AuthUser } from '../services/auth';

// F089 (W1 task 10): we no longer track the token in localStorage, so
// the cross-tab signal can't be the token key. Use the user key as a
// proxy for "auth state changed in another tab" — when the user object
// is removed (logout, refresh failure), this tab logs out too.
const USER_STORAGE_KEY = 'control_plane_user';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: AuthRole | AuthRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // F089: on mount, the in-memory access token is always null (page
  // reload wipes it). Attempt a silent refresh against the HttpOnly
  // refresh cookie. If the cookie is still valid, we get a fresh
  // access token without a re-login. If it isn't, we land on /login.
  useEffect(() => {
    const storedUser = authService.getUser();
    if (!storedUser) {
      setIsLoading(false);
      return;
    }
    // Optimistically render with the cached user, then validate.
    setUser(storedUser);
    authService
      .refresh()
      .then(() => authService.getProfile())
      .then(setUser)
      .catch(() => {
        // Refresh failed — cookie expired or revoked. Bounce to login.
        setUser(null);
        authService.clearLocal();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // F089 cross-tab logout: when another tab clears the user (via
  // logout or refresh failure), propagate logout here. The token
  // itself is not in localStorage anymore so we can't watch the token
  // key — but the user key tracks the same lifecycle.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== USER_STORAGE_KEY) return;
      if (event.newValue === null) {
        setUser(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setUser(response.user);

    // Redirect to intended page or dashboard
    const from = (location.state as any)?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  const logout = async () => {
    setUser(null);
    await authService.logout();
  };

  const hasRole = (role: AuthRole | AuthRole[]) => {
    return authService.hasRole(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
