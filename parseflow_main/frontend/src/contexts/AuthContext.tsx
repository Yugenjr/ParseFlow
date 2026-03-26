import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUserByEmail, addUser, seedDemoData, type User } from '@/lib/indexeddb';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await seedDemoData();
      const stored = localStorage.getItem('parseflow_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const dbUser = await getUserByEmail(parsed.email);
          if (dbUser) setUser(dbUser);
        } catch { /* invalid stored data */ }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const dbUser = await getUserByEmail(email);
    if (!dbUser) return { success: false, error: 'User not found' };
    if (dbUser.password !== password) return { success: false, error: 'Invalid password' };
    setUser(dbUser);
    localStorage.setItem('parseflow_user', JSON.stringify({ email: dbUser.email, id: dbUser.id }));
    return { success: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const existing = await getUserByEmail(email);
    if (existing) return { success: false, error: 'Email already registered' };
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
    };
    await addUser(newUser);
    setUser(newUser);
    localStorage.setItem('parseflow_user', JSON.stringify({ email: newUser.email, id: newUser.id }));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('parseflow_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
