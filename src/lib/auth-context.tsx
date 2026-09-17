import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { Plan } from '../shared/plans';

type User = { id: string; email: string; emailVerified: boolean };

type MeResponse = {
  user: User;
  plan: Plan;
  features: readonly string[];
  limits: Record<string, number>;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

type AuthState = {
  user: User | null;
  plan: Plan;
  features: readonly string[];
  limits: Record<string, number>;
  subscription: MeResponse['subscription'];
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh' | 'login' | 'register' | 'logout'>>({
    user: null, plan: 'free', features: [], limits: {}, subscription: null, loading: true,
  });

  async function refresh() {
    try {
      const me = await api<MeResponse>('/me');
      setState({
        user: me.user,
        plan: me.plan,
        features: me.features,
        limits: me.limits,
        subscription: me.subscription,
        loading: false,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState((s) => ({ ...s, user: null, plan: 'free', features: [], limits: {}, subscription: null, loading: false }));
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }

  useEffect(() => { refresh(); }, []);

  const login = async (email: string, password: string) => {
    await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await refresh();
  };

  const register = async (email: string, password: string) => {
    await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    await refresh();
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setState((s) => ({ ...s, user: null, plan: 'free', features: [], limits: {}, subscription: null }));
  };

  return (
    <AuthCtx.Provider value={{ ...state, refresh, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}