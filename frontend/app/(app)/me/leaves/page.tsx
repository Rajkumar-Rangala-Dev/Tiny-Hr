"use client";
import { useEffect, useState } from "react";
import { meApi, leavesApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Calendar, Check, X, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MyLeavesPage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [applyData, setApplyData] = useState({
    leave_type_id: "",
    from_date: "",
    to_date: "",
    reason: "",
  });

  const [showApplyForm, setShowApplyForm] = useState(false);

  const fetchLeavesData = async () => {
    try {
      const year = new Date().getFullYear();
      const [balRes, reqsRes, typesRes] = await Promise.all([
        meApi.getLeaveBalances(year),
        meApi.getLeaveRequests(),
        leavesApi.listTypes(),
      ]);
      setBalances(balRes.data);
      setRequests(reqsRes.data);
      setLeaveTypes(typesRes.data);
    } catch (err) {
      console.error("Failed to load leaves data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeavesData();
  }, []);

  const handleApplyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setApplyData({ ...applyData, [e.target.name]: e.target.value });
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      // Find my profile details first to obtain employee_id
      const profRes = await meApi.getProfile();
      const myEmpId = profRes.data.id;

      await meApi.applyLeave({
        employee_id: myEmpId,
        leave_type_id: applyData.leave_type_id,
        from_date: applyData.from_date,
        to_date: applyData.to_date,
        reason: applyData.reason,
      });

      setSuccess("Leave application submitted successfully!");
      setApplyData({ leave_type_id: "", from_date: "", to_date: "", reason: "" });
      setShowApplyForm(false);
      fetchLeavesData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit leave application");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "cancelled":
        return "bg-slate-100 text-slate-800 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-muted-foreground mt-1">View leave balances, submit requests, and check approval history.</p>
        </div>

        <button
          onClick={() => setShowApplyForm(!showApplyForm)}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 shrink-0 gap-2"
        >
          {showApplyForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showApplyForm ? "Close Form" : "Apply for Leave"}
        </button>
      </div>

      {success && <div className="text-sm text-green-600 bg-green-50 border border-green-200 p-3 rounded-lg">{success}</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</div>}

      {/* Apply Leave Form */}
      {showApplyForm && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Apply for Leave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leave_type_id">Leave Type</Label>
                  <select
                    id="leave_type_id"
                    name="leave_type_id"
                    value={applyData.leave_type_id}
                    onChange={handleApplyChange}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from_date">Start Date</Label>
                  <Input
                    type="date"
                    id="from_date"
                    name="from_date"
                    value={applyData.from_date}
                    onChange={handleApplyChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to_date">End Date</Label>
                  <Input
                    type="date"
                    id="to_date"
                    name="to_date"
                    value={applyData.to_date}
                    onChange={handleApplyChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Leave</Label>
                <textarea
                  id="reason"
                  name="reason"
                  value={applyData.reason}
                  onChange={handleApplyChange}
                  required
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
                  placeholder="Explain brief reason for leave"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 min-w-[120px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : "Submit Request"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {balances.map((b) => (
          <Card key={b.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{b.leave_type_name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{b.leave_type_code}</p>
                </div>
                <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {b.total_days} Days / Yr
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 text-center">
                <div className="border-r border-slate-100">
                  <p className="text-xs text-muted-foreground">Used</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">{b.used_days} Days</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-lg font-bold text-green-700 mt-0.5">{b.remaining_days} Days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leave Requests Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">My Leave Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              You haven&apos;t applied for any leave requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 font-medium text-slate-700">
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reviewed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-semibold">{req.leave_type_name}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {formatDate(req.from_date)} → {formatDate(req.to_date)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{req.num_days} {req.num_days === 1 ? "day" : "days"}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate" title={req.reason}>{req.reason}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusColor(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {req.status === "approved" && <span className="flex items-center gap-1 text-green-700 text-xs"><Check className="h-3 w-3" /> Approved</span>}
                        {req.status === "rejected" && (
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 text-red-700 text-xs"><X className="h-3 w-3" /> Rejected</span>
                            {req.rejection_reason && <span className="text-[10px] text-slate-400 font-normal">{req.rejection_reason}</span>}
                          </div>
                        )}
                        {req.status === "pending" && <span className="flex items-center gap-1 text-amber-700 text-xs"><AlertTriangle className="h-3 w-3" /> Awaiting review</span>}
                      </td>
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
