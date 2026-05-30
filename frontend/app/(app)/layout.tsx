"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Loader2 } from "lucide-react";

const ADMIN_ONLY_ROUTES = ["/dashboard", "/employees", "/attendance", "/leaves", "/payroll", "/documents", "/onboarding", "/offboarding", "/settings"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role === "employee" && ADMIN_ONLY_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"))) {
        router.replace("/me/dashboard");
      }
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  // Render children only if it's not an unauthorized admin route for employees
  const isUnauthorized = user.role === "employee" && ADMIN_ONLY_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
  if (isUnauthorized) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
