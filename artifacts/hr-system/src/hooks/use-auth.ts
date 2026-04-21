import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export type Role = "hr" | "employee";

export interface User {
  username: string;
  role: Role;
  name: string;
}

const STORAGE_KEY = "hr_user";
const AUTH_EVENT = "hr-auth-changed";

function readStored(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => readStored());
  const [, setLocation] = useLocation();

  useEffect(() => {
    const sync = () => setUser(readStored());
    window.addEventListener("storage", sync);
    window.addEventListener(AUTH_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(AUTH_EVENT, sync);
    };
  }, []);

  const login = useCallback((username: string, role: Role, name: string) => {
    const u: User = { username, role, name };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    window.dispatchEvent(new Event(AUTH_EVENT));
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    window.dispatchEvent(new Event(AUTH_EVENT));
    setLocation("/login");
  }, [setLocation]);

  return { user, isLoading: false, login, logout };
}
