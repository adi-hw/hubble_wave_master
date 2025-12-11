import { useEffect, useState } from 'react';
import { createApiClient } from '../services/api';
import { getStoredToken } from '../services/token';
import { useAuth } from './AuthContext';

// Use identity service for IAM endpoints (with token refresh interceptor)
// In development, use proxy path to avoid cross-origin cookie issues
const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';
const identityApi = createApiClient(IDENTITY_API_URL);

export interface UserProfile {
  id?: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  locale?: string;
  timeZone?: string;
  title?: string;
  department?: string;
  preferences: Record<string, any>;
}

export const useProfile = () => {
  const { auth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch profile when user is authenticated
  const isAuthenticated = !!auth.user && !auth.loading;

  useEffect(() => {
    // Don't load profile if not authenticated or still checking auth
    if (!isAuthenticated) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Also check if we have a token
    const token = getStoredToken();
    if (!token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await identityApi.get('/iam/profile');
        if (!cancelled) {
          setProfile(res.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('Failed to load profile:', err?.message);
          setError(err?.message || 'Failed to load profile');
          // Set a default profile so the app doesn't break
          setProfile({
            displayName: 'User',
            preferences: {},
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return { profile, loading, error };
};
