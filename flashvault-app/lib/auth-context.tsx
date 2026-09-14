"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type User = {
  id: string;
  role: "CUSTOMER" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";
  name: string;
  email?: string;
  phone?: string;
  merchantId?: string;
  merchant?: any;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (data: any) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ ok: false }),
  signup: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setUser(d.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) return { ok: false, error: d.error };
      setUser(d.user);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  };

  const signup = async (data: any) => {
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) return { ok: false, error: d.error };
      setUser(d.user);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
