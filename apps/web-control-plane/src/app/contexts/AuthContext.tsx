import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService, AuthRole, AuthUser } from '../services/auth';

const TOKEN_STORAGE_KEY = 'control_plane_token';

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

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = authService.getUser();
    const token = authService.getToken();

    if (token && storedUser) {
      setUser(storedUser);
      // Optionally verify token with backend
      authService.getProfile()
        .then(setUser)
        .catch(() => {
          // Token invalid, clear and redirect
          authService.logout();
        });
    }
    setIsLoading(false);
  }, []);

  // Multi-tab logout sync: when another tab clears the token, propagate the
  // logout to this tab so we never render authenticated UI against a cleared
  // localStorage.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_STORAGE_KEY) return;
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
