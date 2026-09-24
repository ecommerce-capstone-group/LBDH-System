import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export type Role = "hr" | "employee" | "unit_head";

export interface User {
  username: string;
  role: Role;
  name: string;
}

const STORAGE_KEY = "hr_user";
const AUTH_EVENT = "hr-auth-changed";
const VALID_ROLES: Role[] = ["hr", "employee", "unit_head"];

function readStored(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as User;
    if (!VALID_ROLES.includes(parsed.role)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
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
