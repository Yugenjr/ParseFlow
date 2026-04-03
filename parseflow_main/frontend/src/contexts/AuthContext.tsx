import React, { createContext, useContext, useMemo, useEffect, useCallback, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import type { User } from '@/lib/indexeddb';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  syncUser: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getReliableClerkToken(getToken: ReturnType<typeof useClerkAuth>["getToken"]): Promise<string | null> {
  // Mobile WebView sessions can take longer to issue the first usable JWT after sign-in.
  // Retry for a longer window so initial data fetches don't silently return empty.
  for (let i = 0; i < 30; i += 1) {
    let token = await getToken();
    if (!token) {
      token = await getToken({ skipCache: true });
    }
    if (token) return token;
    await wait(400);
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken, signOut } = useClerkAuth();
  const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [authBootstrapTimedOut, setAuthBootstrapTimedOut] = useState(false);

  useEffect(() => {
    console.log('[Auth] state', {
      isLoaded,
      isSignedIn,
      hasUser: Boolean(clerkUser),
      userId: clerkUser?.id,
      backendBaseUrl,
      clerkKeyPresent: Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
    });
  }, [backendBaseUrl, clerkUser, isLoaded, isSignedIn]);

  useEffect(() => {
    if (isLoaded) {
      setAuthBootstrapTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      console.warn('[Auth] Clerk has not loaded in time; allowing the app to render with fallback routing.');
      setAuthBootstrapTimedOut(true);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  const user = useMemo<User | null>(() => {
    if (!isSignedIn || !clerkUser) return null;
    const fallbackName = clerkUser.emailAddresses[0]?.emailAddress?.split('@')[0] || 'User';
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || fallbackName,
      email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || '',
      password: ''
    };
  }, [isSignedIn, clerkUser]);

  const syncUser = useCallback(async () => {
    if (!isSignedIn) return;
    const token = await getReliableClerkToken(getToken);
    if (!token) return;

    console.log('[Auth] Calling API...', { endpoint: '/api/auth/sync-user' });

    const resp = await fetch(`${backendBaseUrl}/api/auth/sync-user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!resp.ok) {
      throw new Error('Failed to sync user');
    }
  }, [backendBaseUrl, getToken, isSignedIn]);

  const getAuthToken = useCallback(async () => {
    if (!isSignedIn) return null;
    return getReliableClerkToken(getToken);
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!user) return;
    const syncKey = `parseflow_synced_${user.id}`;
    if (localStorage.getItem(syncKey)) return;

    syncUser()
      .then(() => localStorage.setItem(syncKey, '1'))
      .catch((err) => {
        console.warn('User sync failed:', err && (err.message || err));
      });
  }, [syncUser, user]);

  const logout = useCallback(() => {
    signOut();
  }, [signOut]);

  const loading = !isLoaded && !authBootstrapTimedOut;

  return (
    <AuthContext.Provider value={{ user, loading, logout, syncUser, getAuthToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
