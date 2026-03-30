import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearGoogleToken, ensureGoogleAccessToken, fetchGoogleUserProfile } from '../lib/googleAuth';

const AUTH_USER_KEY = 'snapsearch.auth.user';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  metadata: {
    creationTime: string;
  };
}

function loadUser(): AppUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

function saveUser(user: AppUser | null) {
  if (!user) {
    localStorage.removeItem(AUTH_USER_KEY);
    return;
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string, photoURL?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(loadUser());
    setLoading(false);
  }, []);

  const login = async () => {
    const existing = loadUser();
    if (existing) {
      setUser(existing);
      return;
    }

    const accessToken = await ensureGoogleAccessToken(true);
    const profile = await fetchGoogleUserProfile(accessToken);
    const nextUser: AppUser = {
      uid: profile.uid || makeId(),
      displayName: profile.displayName,
      email: profile.email,
      photoURL: profile.photoURL,
      metadata: {
        creationTime: new Date().toISOString(),
      },
    };

    saveUser(nextUser);
    setUser(nextUser);
  };

  const logout = async () => {
    clearGoogleToken();
    saveUser(null);
    setUser(null);
  };

  const updateProfile = async (displayName: string, photoURL?: string) => {
    if (!user) return;
    const updated: AppUser = {
      ...user,
      displayName,
      photoURL: photoURL ?? user.photoURL,
    };
    saveUser(updated);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>
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
