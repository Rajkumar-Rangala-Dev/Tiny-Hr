"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarOff,
  DollarSign, Settings, LogOut, Briefcase, User, FileText,
  ClipboardCheck, UserMinus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const ADMIN_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leaves", label: "Leave Management", icon: CalendarOff },
  { href: "/payroll", label: "Payroll", icon: DollarSign },
  { href: "/documents", label: "Documents & Letters", icon: FileText },
  { href: "/onboarding", label: "Onboarding Checklist", icon: ClipboardCheck },
  { href: "/offboarding", label: "Offboarding Exit", icon: UserMinus },
  { href: "/settings", label: "Settings", icon: Settings },
];

const EMPLOYEE_NAV_ITEMS = [
  { href: "/me/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/me/profile", label: "My Profile", icon: User },
  { href: "/me/onboarding", label: "My Onboarding", icon: ClipboardCheck },
  { href: "/me/attendance", label: "My Attendance", icon: CalendarCheck },
  { href: "/me/leaves", label: "My Leaves", icon: CalendarOff },
  { href: "/me/payslips", label: "My Payslips", icon: FileText },
  { href: "/me/documents", label: "My Letters & Docs", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navItems = user?.role === "employee" ? EMPLOYEE_NAV_ITEMS : ADMIN_NAV_ITEMS;

  return (
    <aside className="flex flex-col w-64 bg-slate-900 text-slate-100 min-h-screen shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
        <div className="bg-blue-500 rounded-lg p-1.5">
          <Briefcase className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">Tiny HR</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="text-xs text-slate-400 mb-1 truncate">{user?.email}</div>
        <div className="text-sm font-medium truncate mb-3">{user?.full_name}</div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
