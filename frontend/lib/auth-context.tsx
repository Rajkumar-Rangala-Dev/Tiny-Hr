"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { authApi } from "./api";

interface AuthUser {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  employee_id?: string;
  must_change_password: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh token before expiry (every 45 minutes)
  useEffect(() => {
    if (!token) return;

    // Clear existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    // Refresh every 45 minutes (before 60-minute expiry)
    refreshTimerRef.current = setInterval(async () => {
      try {
        const res = await authApi.refreshToken();
        const { access_token } = res.data;
        Cookies.set("access_token", access_token, {
          expires: 1,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Strict",
        });
        setToken(access_token);
        console.debug("Token refreshed successfully");
      } catch (err) {
        console.error("Token refresh failed:", err);
        logout();
      }
    }, 45 * 60 * 1000); // 45 minutes

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [token]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = Cookies.get("access_token");
        if (savedToken) {
          setToken(savedToken);
          const res = await authApi.me();
          setUser(res.data);
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    try {
      const res = await authApi.login({ email, password });

      if (!res.data?.access_token || !res.data?.user_id) {
        throw new Error("Invalid server response");
      }

      const { access_token, ...userData } = res.data;
      Cookies.set("access_token", access_token, {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      });
      setToken(access_token);

      const meRes = await authApi.me();
      if (!meRes.data?.id || !meRes.data?.email) {
        throw new Error("Failed to load user data");
      }

      setUser(meRes.data);
      return meRes.data;
    } catch (err) {
      console.error("Login error:", err);
      logout();
      throw err;
    }
  };

  const logout = () => {
    Cookies.remove("access_token");
    setUser(null);
    setToken(null);
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
