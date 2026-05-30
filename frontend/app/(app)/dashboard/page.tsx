"use client";
import { useEffect, useState } from "react";
import { employeesApi, attendanceApi, leavesApi, payrollApi, meApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, CalendarCheck, CalendarOff, DollarSign, TrendingUp,
  AlertCircle, User, FileText, Calendar, CheckCircle
} from "lucide-react";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  pendingLeaves: number;
  lastPayrollNet: number;
  lastPayrollMonth: string;
}

interface EmployeeStats {
  leaveBalance: number;
  leavesTaken: number;
  presentDaysThisMonth: number;
  lastPayslipAmount: number;
  lastPayslipMonth: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    lastPayrollNet: 0,
    lastPayrollMonth: "",
  });

  const [empStats, setEmpStats] = useState<EmployeeStats>({
    leaveBalance: 0,
    leavesTaken: 0,
    presentDaysThisMonth: 0,
    lastPayslipAmount: 0,
    lastPayslipMonth: "",
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        if (user?.role === "employee") {
          const [balancesRes, requestsRes, attRes, slipsRes] = await Promise.allSettled([
            meApi.getLeaveBalances(now.getFullYear()),
            meApi.getLeaveRequests({ status: "approved" }),
            meApi.getAttendance({ month: now.getMonth() + 1, year: now.getFullYear() }),
            meApi.getPayslips(),
          ]);

          const balances = balancesRes.status === "fulfilled" ? balancesRes.value.data : [];
          const requests = requestsRes.status === "fulfilled" ? requestsRes.value.data : [];
          const attendance = attRes.status === "fulfilled" ? attRes.value.data : [];
          const slips = slipsRes.status === "fulfilled" ? slipsRes.value.data : [];

          // Total leave balance remaining across all leave types
          const totalRemaining = balances.reduce((acc: number, cur: any) => acc + (cur.remaining_days || 0), 0);
          const totalUsed = balances.reduce((acc: number, cur: any) => acc + (cur.used_days || 0), 0);

          const presentCount = attendance.filter((r: any) => r.status === "present" || r.status === "work_from_home").length;
          const latestSlip = slips[0];

          setEmpStats({
            leaveBalance: totalRemaining,
            leavesTaken: totalUsed,
            presentDaysThisMonth: presentCount,
            lastPayslipAmount: latestSlip?.net_pay ?? 0,
            lastPayslipMonth: latestSlip ? `${MONTHS[latestSlip.month - 1]} ${latestSlip.year}` : "No payslip yet",
          });
        } else {
          const [empsRes, attRes, leavesRes, payrollRes] = await Promise.allSettled([
            employeesApi.list({ status: "active" }),
            attendanceApi.summary(now.getMonth() + 1, now.getFullYear()),
            leavesApi.listRequests({ status: "pending" }),
            payrollApi.listRuns(),
          ]);

          const emps = empsRes.status === "fulfilled" ? empsRes.value.data : [];
          const att = attRes.status === "fulfilled" ? attRes.value.data : [];
          const leaves = leavesRes.status === "fulfilled" ? leavesRes.value.data : [];
          const runs = payrollRes.status === "fulfilled" ? payrollRes.value.data : [];

          const presentToday = att.filter((s: { present: number }) => s.present > 0).length;
          const lastRun = runs[0];

          setStats({
            totalEmployees: emps.length,
            presentToday,
            pendingLeaves: leaves.length,
            lastPayrollNet: lastRun?.total_net ?? 0,
            lastPayrollMonth: lastRun
              ? `${MONTHS[lastRun.month - 1]} ${lastRun.year}`
              : "No payroll yet",
          });
        }
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchStats();
    }
  }, [user]);

  if (user?.role === "employee") {
    const empCards = [
      {
        title: "Remaining Leaves",
        value: `${empStats.leaveBalance} Days`,
        icon: CalendarOff,
        color: "text-amber-600",
        bg: "bg-amber-50",
        description: "Available balance",
      },
      {
        title: "Leaves Used",
        value: `${empStats.leavesTaken} Days`,
        icon: Calendar,
        color: "text-blue-600",
        bg: "bg-blue-50",
        description: "This calendar year",
      },
      {
        title: "Attendance Days",
        value: `${empStats.presentDaysThisMonth} Days`,
        icon: CalendarCheck,
        color: "text-green-600",
        bg: "bg-green-50",
        description: "Present this month",
      },
      {
        title: "Latest Net Pay",
        value: formatCurrency(empStats.lastPayslipAmount),
        icon: DollarSign,
        color: "text-purple-600",
        bg: "bg-purple-50",
        description: empStats.lastPayslipMonth,
      },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.full_name}</h1>
          <p className="text-muted-foreground mt-1">Here is a quick overview of your profile and portal.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-16 bg-slate-100 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {empCards.map(({ title, value, icon: Icon, color, bg, description }) => (
              <Card key={title}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{title}</p>
                      <p className="text-2xl font-bold mt-1">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    </div>
                    <div className={`${bg} p-3 rounded-full`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Self Service Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Apply for Leave", href: "/me/leaves" },
                { label: "View My Attendance", href: "/me/attendance" },
                { label: "Download Latest Payslip", href: "/me/payslips" },
                { label: "View/Edit Profile", href: "/me/profile" },
              ].map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-slate-400 group-hover:text-slate-700 text-lg leading-none">→</span>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Portal Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {[
                  "Apply for leave requests directly in the leaves tab.",
                  "Regularize or track your daily present/absent logs in attendance.",
                  "Download PDF copies of your processed payslips monthly.",
                  "Keep your address, phone, and banking details updated in profile.",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Active Employees",
      value: stats.totalEmployees,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Currently active",
    },
    {
      title: "Present This Month",
      value: stats.presentToday,
      icon: CalendarCheck,
      color: "text-green-600",
      bg: "bg-green-50",
      description: "Employees with attendance",
    },
    {
      title: "Pending Leaves",
      value: stats.pendingLeaves,
      icon: CalendarOff,
      color: "text-amber-600",
      bg: "bg-amber-50",
      description: "Awaiting review",
    },
    {
      title: "Last Payroll Net",
      value: formatCurrency(stats.lastPayrollNet),
      icon: DollarSign,
      color: "text-purple-600",
      bg: "bg-purple-50",
      description: stats.lastPayrollMonth,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-slate-100 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ title, value, icon: Icon, color, bg, description }) => (
            <Card key={title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                  </div>
                  <div className={`${bg} p-3 rounded-full`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Upload Attendance CSV", href: "/attendance" },
              { label: "Run Payroll", href: "/payroll" },
              { label: "Review Leave Requests", href: "/leaves" },
              { label: "Add New Employee", href: "/employees/new" },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors group"
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-slate-400 group-hover:text-slate-700 text-lg leading-none">→</span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                "Add your employees (or import via CSV)",
                "Upload monthly attendance CSV from clients",
                "Set up leave types and initialize balances",
                "Run payroll at month-end",
                "Generate and download payslips as PDF",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
