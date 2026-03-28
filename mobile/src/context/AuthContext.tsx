import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { insforge } from '../services/insforge';

WebBrowser.maybeCompleteAuthSession();

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; requiresVerification: boolean }>;
  verifyEmail: (email: string, otp: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Upsert a row in public.users so profile/budget data exists.
async function syncUserRecord(id: string, email: string) {
  const { error } = await insforge.database
    .from('users')
    .upsert([{ id, email }], { onConflict: 'id' });
  if (error) console.error('[Auth] syncUserRecord error:', error);
  else console.log('[Auth] syncUserRecord ok for', email);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insforge.auth.getCurrentUser().then(({ data }) => {
      if (data?.user) {
        const { id, email } = data.user;
        setUser({ id, email });
        syncUserRecord(id, email);
      }
      setLoading(false);
    });
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    console.log('[Auth] signIn →', email);
    const { data, error } = await insforge.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth] signIn error:', error);
      return error.message;
    }
    console.log('[Auth] signIn success:', data?.user?.email);
    if (data?.user) {
      setUser({ id: data.user.id, email: data.user.email });
      await syncUserRecord(data.user.id, data.user.email);
    }
    return null;
  }

  async function signUp(email: string, password: string): Promise<{ error: string | null; requiresVerification: boolean }> {
    console.log('[Auth] signUp →', email);
    const { data, error } = await insforge.auth.signUp({ email, password });
    if (error) {
      console.error('[Auth] signUp error:', error);
      return { error: error.message, requiresVerification: false };
    }
    console.log('[Auth] signUp response:', JSON.stringify(data));
    if (data?.requireEmailVerification) {
      return { error: null, requiresVerification: true };
    }
    if (data?.user) {
      setUser({ id: data.user.id, email: data.user.email });
      await syncUserRecord(data.user.id, data.user.email);
    }
    return { error: null, requiresVerification: false };
  }

  async function verifyEmail(email: string, otp: string): Promise<string | null> {
    console.log('[Auth] verifyEmail →', email);
    const { data, error } = await insforge.auth.verifyEmail({ email, otp });
    if (error) {
      console.error('[Auth] verifyEmail error:', error);
      return error.message;
    }
    console.log('[Auth] verifyEmail success:', data?.user?.email);
    const u = data?.user;
    if (u) {
      setUser({ id: u.id, email: u.email });
      await syncUserRecord(u.id, u.email);
    }
    return null;
  }

  async function signInWithGoogle(): Promise<string | null> {
    const redirectUrl = Linking.createURL('auth-callback');

    const { data, error } = await insforge.auth.signInWithOAuth({
      provider: 'google',
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    });

    if (error) return error.message;
    if (!data?.url) return 'Failed to get Google sign-in URL';

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type !== 'success') return 'Sign in cancelled';

    const raw = result.url;
    const queryStr = raw.includes('?') ? raw.split('?')[1].split('#')[0] : '';
    const fragmentStr = raw.includes('#') ? raw.split('#')[1] : '';
    const queryParams = new URLSearchParams(queryStr);
    const fragmentParams = new URLSearchParams(fragmentStr);

    const insforge_code = queryParams.get('insforge_code') ?? fragmentParams.get('insforge_code');
    const access_token = queryParams.get('access_token') ?? fragmentParams.get('access_token');
    const refresh_token = queryParams.get('refresh_token') ?? fragmentParams.get('refresh_token') ?? '';

    let authedUser: AuthUser | null = null;

    if (insforge_code) {
      const { data: session, error: sessionError } = await (insforge.auth as any).exchangeOAuthCode({ code: insforge_code });
      if (sessionError) return sessionError.message;
      const u = session?.user ?? session?.session?.user;
      if (u) authedUser = { id: u.id, email: u.email };
    } else if (access_token) {
      const { data: session, error: sessionError } = await (insforge.auth as any).setSession({ access_token, refresh_token });
      if (sessionError) return sessionError.message;
      const u = session?.user ?? session?.session?.user;
      if (u) authedUser = { id: u.id, email: u.email };
    } else {
      return 'No auth code or token in callback URL';
    }

    if (authedUser) {
      setUser(authedUser);
      await syncUserRecord(authedUser.id, authedUser.email);
    }

    return null;
  }

  async function signOut() {
    await insforge.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, verifyEmail, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
