import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartPulse, Lock } from "lucide-react";
import { toast } from "sonner";

type EmployeeLoginResponse = {
  username: string;
  role: "employee";
  name: string;
  employeeId: number;
};

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = username.trim();
    const pass = password;

    // Existing HR / Unit Head demo logins — unchanged.
    if (user === "hr" && pass === "hr123") {
      login("hr", "hr", "HR Coordinator");
      setLocation("/dashboard");
      return;
    }
    if (user === "unithead" && pass === "unit123") {
      login("unithead", "unit_head", "Unit Head");
      setLocation("/dashboard");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | EmployeeLoginResponse
        | { error?: string };
      if (!res.ok) {
        throw new Error(
          "error" in body && body.error
            ? body.error
            : "Invalid username or password",
        );
      }
      const session = body as EmployeeLoginResponse;
      login(session.username, "employee", session.name, session.employeeId);
      setLocation("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Invalid username or password",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
            <HeartPulse className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Los Banos Doctors Hospital
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Human Resources Management System
          </p>
        </div>

        <Card className="border-gray-200 shadow-xl shadow-gray-200/50">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="border-gray-300 focus:border-primary focus:ring-primary"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-gray-300 focus:border-primary focus:ring-primary"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium shadow-sm"
                disabled={pending}
              >
                <Lock className="mr-2 h-4 w-5" />
                {pending ? "Signing in…" : "Sign in to HRMS"}
              </Button>

              <div className="mt-4 rounded-md bg-blue-50 p-4 border border-blue-100 text-sm text-blue-800">
                <p className="font-semibold mb-1">Demo credentials:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>HR:</strong> hr / hr123
                  </li>
                  <li>
                    <strong>Unit Head:</strong> unithead / unit123
                  </li>
                  <li>
                    <strong>Employee (seeded):</strong> employee / employee123
                  </li>
                  <li>
                    New hires use the username and temporary password shown once
                    to HR when the profile is created.
                  </li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
