"use client";
import { useEffect, useState } from "react";
import { meApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarCheck, CalendarOff, DollarSign, TrendingUp, CheckCircle
} from "lucide-react";
import { formatCurrency, MONTHS } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface EmployeeStats {
  leaveBalance: number;
  leavesTaken: number;
  presentDaysThisMonth: number;
  lastPayslipAmount: number;
  lastPayslipMonth: string;
}

export default function MeDashboardPage() {
  const { user } = useAuth();
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
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchStats();
    }
  }, [user]);

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
      icon: CalendarCheck,
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
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.full_name}</h1>
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
