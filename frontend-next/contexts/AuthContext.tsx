"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth as authApi, type UserProfile, type LoginPayload, type RegisterPayload } from "@/lib/api";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
} from "@/lib/auth";

/* ─── types ───────────────────────────────────────────────── */

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/* ─── provider ────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* fetch profile from /me/ endpoint */
  const fetchProfile = useCallback(async (accessToken: string) => {
    try {
      const profile = await authApi.me(accessToken);
      setUser(profile);
      setToken(accessToken);
    } catch {
      clearTokens();
      setUser(null);
      setToken(null);
    }
  }, []);

  /* on mount — try to restore session */
  useEffect(() => {
    (async () => {
      let access = getAccessToken();
      const refresh = getRefreshToken();

      if (access && !isTokenExpired(access)) {
        await fetchProfile(access);
      } else if (refresh && !isTokenExpired(refresh)) {
        try {
          const data = await authApi.refresh(refresh);
          access = data.access;
          setTokens(access, refresh);
          await fetchProfile(access);
        } catch {
          clearTokens();
        }
      }
      setLoading(false);
    })();
  }, [fetchProfile]);

  /* login */
  const login = useCallback(async (data: LoginPayload) => {
    const tokens = await authApi.login(data);
    setTokens(tokens.access, tokens.refresh);
    await fetchProfile(tokens.access);
  }, [fetchProfile]);

  /* register */
  const register = useCallback(async (data: RegisterPayload) => {
    const tokens = await authApi.register(data);
    setTokens(tokens.access, tokens.refresh);
    await fetchProfile(tokens.access);
  }, [fetchProfile]);

  /* logout */
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── hook ────────────────────────────────────────────────── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
