import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Payslip from "@/pages/payslip";
import Reports from "@/pages/reports";
import Employees from "@/pages/employees";
import EmployeeDetail from "@/pages/employees/[id]";
import Recruitment from "@/pages/recruitment";
import JobDetail from "@/pages/recruitment/[id]";
import ApplyJob from "@/pages/apply/[id]";
import Attendance from "@/pages/attendance";
import Leaves from "@/pages/leaves";
import Requests from "@/pages/requests";
import Performance from "@/pages/performance";
import Offboarding from "@/pages/offboarding";
import SelfService from "@/pages/self-service";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, roles = ["hr", "employee"] }: { component: () => JSX.Element; roles?: Array<"hr" | "employee"> }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
    else if (!isLoading && user && !roles.includes(user.role)) setLocation("/dashboard");
  }, [user, isLoading, setLocation, roles]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !roles.includes(user.role)) return null;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function HomeRoute() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (user) setLocation("/dashboard");
    else setLocation("/login");
  }, [user, isLoading, setLocation]);

  return <div className="min-h-screen bg-background" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}> 
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/apply/:id" component={ApplyJob} />
            <Route path="/" component={HomeRoute} />
            <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
            <Route path="/employees">{() => <ProtectedRoute component={Employees} roles={["hr"]} />}</Route>
            <Route path="/employees/:id">{() => <ProtectedRoute component={EmployeeDetail} roles={["hr"]} />}</Route>
            <Route path="/recruitment">{() => <ProtectedRoute component={Recruitment} roles={["hr"]} />}</Route>
            <Route path="/recruitment/:id">{() => <ProtectedRoute component={JobDetail} roles={["hr"]} />}</Route>
            <Route path="/attendance">{() => <ProtectedRoute component={Attendance} roles={["hr"]} />}</Route>
            <Route path="/leaves">{() => <ProtectedRoute component={Leaves} roles={["hr"]} />}</Route>
            <Route path="/requests">{() => <ProtectedRoute component={Requests} roles={["hr"]} />}</Route>
            <Route path="/performance">{() => <ProtectedRoute component={Performance} roles={["hr"]} />}</Route>
            <Route path="/offboarding">{() => <ProtectedRoute component={Offboarding} roles={["hr"]} />}</Route>
            <Route path="/reports">{() => <ProtectedRoute component={Reports} roles={["hr"]} />}</Route>
            <Route path="/self-service">{() => <ProtectedRoute component={SelfService} roles={["employee"]} />}</Route>
            <Route path="/payslip">{() => <ProtectedRoute component={Payslip} roles={["employee"]} />}</Route>
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
