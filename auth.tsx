import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore, Tokens } from './api';
import { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return; }
    try { setUser(await api<User>('/auth/me')); } catch { tokenStore.clear(); setUser(null); }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
    const out = () => setUser(null);
    window.addEventListener('gvpathshala:signed-out', out);
    return () => window.removeEventListener('gvpathshala:signed-out', out);
  }, [refreshUser]);

  const finish = async (res: Tokens & { user: User }) => { tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken }); setUser(res.user); };
  const value: AuthState = {
    user, loading, refreshUser,
    login: async (email, password) => finish(await api('/auth/login', { body: { email, password } })),
    register: async (name, email, password) => finish(await api('/auth/register', { body: { name, email, password } })),
    logout: () => { tokenStore.clear(); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
