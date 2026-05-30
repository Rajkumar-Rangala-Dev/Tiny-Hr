"use client";
import { useEffect, useState } from "react";
import { meApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, MapPin, Clock, Info } from "lucide-react";
import { formatDate, MONTHS } from "@/lib/utils";

export default function MyAttendancePage() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    meApi.getAttendance({ month: selectedMonth, year: selectedYear })
      .then((res) => {
        setAttendance(res.data);
      })
      .catch((err) => console.error("Failed to load attendance", err))
      .finally(() => setLoading(false));
  }, [selectedMonth, selectedYear]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800 border-green-200";
      case "work_from_home":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "on_leave":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "absent":
        return "bg-red-100 text-red-800 border-red-200";
      case "half_day":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "holiday":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "week_off":
        return "bg-slate-100 text-slate-800 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const stats = {
    present: attendance.filter((r) => r.status === "present").length,
    wfh: attendance.filter((r) => r.status === "work_from_home").length,
    leaves: attendance.filter((r) => r.status === "on_leave" || r.status === "half_day").length,
    absent: attendance.filter((r) => r.status === "absent").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
          <p className="text-muted-foreground mt-1">Track your daily clock-in history and attendance status.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 shrink-0">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MONTHS.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mini Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Office (Present)</p>
              <p className="text-xl font-bold mt-1 text-green-700">{stats.present} Days</p>
            </div>
            <div className="bg-green-50 p-2 rounded-full">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Work From Home</p>
              <p className="text-xl font-bold mt-1 text-blue-700">{stats.wfh} Days</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-full">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">On Leave</p>
              <p className="text-xl font-bold mt-1 text-amber-700">{stats.leaves} Days</p>
            </div>
            <div className="bg-amber-50 p-2 rounded-full">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Absences</p>
              <p className="text-xl font-bold mt-1 text-red-700">{stats.absent} Days</p>
            </div>
            <div className="bg-red-50 p-2 rounded-full">
              <Info className="h-5 w-5 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Attendance Log — {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex py-12 justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No attendance records found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 font-medium text-slate-700">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {attendance.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-medium">{formatDate(record.date)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusColor(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{record.check_in || "—"}</td>
                      <td className="py-3.5 px-4 font-mono">{record.check_out || "—"}</td>
                      <td className="py-3.5 px-4 text-xs capitalize text-slate-500">{record.source}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate" title={record.remarks}>{record.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
