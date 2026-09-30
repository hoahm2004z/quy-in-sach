import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { adminApi } from '@/services/adminApi';
import { getAdminToken, setAdminToken } from '@/features/auth/tokenStorage';
import { getSupabaseBrowserClient, isSupabaseAuthConfigured } from '@/lib/supabase';

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  /** Prefer Supabase Auth when configured; otherwise local /dev-login. */
  login: (email: string, password: string) => Promise<void>;
  /** @deprecated alias of login — kept for existing callers */
  loginDev: (email: string, password: string) => Promise<void>;
  logout: () => void;
  usesSupabaseAuth: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const usesSupabaseAuth = isSupabaseAuthConfigured();

  const refreshMe = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await adminApi.get('/api/admin/auth/me');
      setUser(res.data.data);
    } catch {
      setAdminToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const loginWithDevEndpoint = useCallback(async (email: string, password: string) => {
    const res = await adminApi.post('/api/admin/auth/dev-login', { email, password });
    setAdminToken(res.data.data.accessToken);
    setUser(res.data.data.user);
  }, []);

  const loginWithSupabase = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) {
      throw error ?? new Error('Đăng nhập Supabase thất bại');
    }
    setAdminToken(data.session.access_token);
    const res = await adminApi.get('/api/admin/auth/me');
    setUser(res.data.data);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      if (usesSupabaseAuth) {
        await loginWithSupabase(email, password);
        return;
      }
      await loginWithDevEndpoint(email, password);
    },
    [usesSupabaseAuth, loginWithSupabase, loginWithDevEndpoint],
  );

  const logout = useCallback(() => {
    setAdminToken(null);
    setUser(null);
    if (usesSupabaseAuth) {
      void getSupabaseBrowserClient().auth.signOut().catch(() => undefined);
    }
  }, [usesSupabaseAuth]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginDev: login,
      logout,
      usesSupabaseAuth,
    }),
    [user, loading, login, logout, usesSupabaseAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth phải nằm trong AdminAuthProvider');
  return ctx;
}
