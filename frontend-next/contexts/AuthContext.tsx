"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  PROFILE_SYNC_EVENT,
  auth as authApi,
  type LoginPayload,
  type RegisterPayload,
  type UserProfile,
} from "@/lib/api";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAuthState = useCallback(() => {
    setUser(null);
  }, []);

  const fetchProfile = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchProfile();
      } catch {
        clearAuthState();
      } finally {
        setLoading(false);
      }
    })();
  }, [clearAuthState, fetchProfile]);

  const login = useCallback(
    async (data: LoginPayload) => {
      await authApi.login(data);
      await fetchProfile();
    },
    [fetchProfile],
  );

  const register = useCallback(
    async (data: RegisterPayload) => {
      await authApi.register(data);
      await fetchProfile();
    },
    [fetchProfile],
  );

  const refreshProfile = useCallback(async () => {
    try {
      await fetchProfile();
    } catch {
      clearAuthState();
    }
  }, [clearAuthState, fetchProfile]);

  useEffect(() => {
    function scheduleProfileSync() {
      if (!user) {
        return;
      }

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        void refreshProfile();
      }, 300);
    }

    window.addEventListener(PROFILE_SYNC_EVENT, scheduleProfileSync);

    return () => {
      window.removeEventListener(PROFILE_SYNC_EVENT, scheduleProfileSync);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [refreshProfile, user]);

  const logout = useCallback(() => {
    void authApi.logout().catch(() => undefined);
    clearAuthState();
  }, [clearAuthState]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
