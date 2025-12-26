import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'operator' | 'viewer';
  avatarUrl?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

const TOKEN_KEY = 'control_plane_token';
const USER_KEY = 'control_plane_user';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    const { accessToken, user } = response.data;

    // Store token and user
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return response.data;
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  async getProfile(): Promise<AuthUser> {
    const response = await api.get<AuthUser>('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    return response.data;
  },

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string }): Promise<AuthUser> {
    const response = await api.put<AuthUser>('/auth/me', data);
    localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  hasRole(requiredRole: AuthUser['role']): boolean {
    const user = this.getUser();
    if (!user) return false;

    const roleHierarchy: Record<AuthUser['role'], number> = {
      super_admin: 4,
      admin: 3,
      operator: 2,
      viewer: 1,
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  },
};

export default authService;
