import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export type Role = "hr" | "employee";

export interface User {
  username: string;
  role: Role;
  name: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedUser = localStorage.getItem("hr_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("hr_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (username: string, role: Role, name: string) => {
    const u = { username, role, name };
    setUser(u);
    localStorage.setItem("hr_user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("hr_user");
    setLocation("/login");
  };

  return { user, isLoading, login, logout };
}
