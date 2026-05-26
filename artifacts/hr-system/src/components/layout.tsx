import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarCheck,
  CalendarOff,
  FileText,
  TrendingUp,
  UserMinus,
  PieChart,
  LogOut,
  Menu,
  HeartPulse,
  UserCircle,
  Receipt,
  GraduationCap,
  ShieldAlert,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const hrLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employees", label: "Employees", icon: Users },
    { href: "/recruitment", label: "Recruitment", icon: Briefcase },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/leaves", label: "Leaves", icon: CalendarOff },
    { href: "/requests", label: "Requests", icon: FileText },
    { href: "/performance", label: "Performance", icon: TrendingUp },
    { href: "/training", label: "Training", icon: GraduationCap },
    { href: "/incidents", label: "Incidents", icon: ShieldAlert },
    { href: "/offboarding", label: "Offboarding", icon: UserMinus },
    { href: "/reports", label: "Reports", icon: PieChart },
  ];

  const employeeLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/self-service", label: "Self Service", icon: UserCircle },
    { href: "/payslip", label: "Payslip", icon: Receipt },
  ];

  const links = user.role === "hr" ? hrLinks : employeeLinks;

  const NavLinks = () => (
    <nav className="space-y-1 p-4">
      {links.map((link) => {
        const isActive = location === link.href || location.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href}>
            <div
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <link.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-gray-400"}`} />
              {link.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="font-bold text-gray-900">LBDH HR</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm sm:px-6">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex h-16 items-center gap-2 border-b px-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-gray-900">LBDH HR</span>
                </div>
                <div className="overflow-y-auto">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
            
            <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">
              {links.find((l) => location === l.href || location.startsWith(`${l.href}/`))?.label || "Los Banos Doctors Hospital HR"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-900">{user.name}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{user.role}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Log out" className="text-gray-500 hover:text-red-600 hover:bg-red-50">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
