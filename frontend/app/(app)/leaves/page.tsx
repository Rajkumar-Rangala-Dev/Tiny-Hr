"use client";
import { useEffect, useState } from "react";
import { leavesApi, employeesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, CalendarOff, Plus, Settings, ListChecks } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface LeaveRequest {
  id: string;
  employee_name: string;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  num_days: number;
  reason: string | null;
  status: string;
  created_at: string;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  default_days_per_year: number;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: "bg-amber-100 text-amber-800", icon: <Clock className="h-3 w-3" /> },
  approved: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { color: "bg-slate-100 text-slate-600", icon: <XCircle className="h-3 w-3" /> },
};

const TABS = [
  { id: "requests", label: "Requests", icon: ListChecks },
  { id: "create", label: "Create Request", icon: Plus },
  { id: "setup", label: "Setup", icon: Settings },
];

export default function LeavesPage() {
  const [activeTab, setActiveTab] = useState("requests");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Create request state
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [createForm, setCreateForm] = useState({ employee_id: "", leave_type_id: "", from_date: "", to_date: "", reason: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Setup state
  const [newType, setNewType] = useState({ name: "", code: "", default_days_per_year: "12" });
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [initYear, setInitYear] = useState(String(new Date().getFullYear()));

  const fetchRequests = async (status = filter) => {
    setLoading(true);
    try {
      const res = await leavesApi.listRequests({ status });
      setRequests(res.data);
    } finally { setLoading(false); }
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await leavesApi.listTypes();
      setLeaveTypes(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchRequests(filter);
    fetchLeaveTypes();
    employeesApi.list({ status: "active" }).then((res) => setEmployees(res.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchRequests(filter); }, [filter]);

  const handleReview = async (id: string, status: "approved" | "rejected", reason?: string) => {
    setReviewing(id);
    try {
      await leavesApi.reviewRequest(id, { status, rejection_reason: reason });
      fetchRequests(filter);
    } finally { setReviewing(null); }
  };

  const handleCreateRequest = async () => {
    if (!createForm.employee_id || !createForm.leave_type_id || !createForm.from_date || !createForm.to_date) {
      setCreateError("All fields except reason are required.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    setCreateResult(null);
    try {
      await leavesApi.createRequest({
        employee_id: createForm.employee_id,
        leave_type_id: createForm.leave_type_id,
        from_date: createForm.from_date,
        to_date: createForm.to_date,
        reason: createForm.reason || undefined,
      });
      const emp = employees.find((e) => e.id === createForm.employee_id);
      setCreateResult(`Leave request created for ${emp?.full_name || "employee"}.`);
      setCreateForm({ employee_id: "", leave_type_id: "", from_date: "", to_date: "", reason: "" });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(msg || "Failed to create leave request.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateType = async () => {
    if (!newType.name || !newType.code) {
      setSetupError("Name and code are required.");
      return;
    }
    setSetupLoading(true);
    setSetupError(null);
    setSetupResult(null);
    try {
      await leavesApi.createType({
        name: newType.name,
        code: newType.code,
        default_days_per_year: parseInt(newType.default_days_per_year) || 12,
      });
      setSetupResult(`Leave type "${newType.name}" created.`);
      setNewType({ name: "", code: "", default_days_per_year: "12" });
      fetchLeaveTypes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSetupError(msg || "Failed to create leave type.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleInitBalances = async () => {
    setSetupLoading(true);
    setSetupError(null);
    setSetupResult(null);
    try {
      const res = await leavesApi.initBalances(parseInt(initYear));
      setSetupResult(`Initialized ${res.data.initialized} leave balance(s) for ${initYear}.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSetupError(msg || "Failed to initialize balances.");
    } finally {
      setSetupLoading(false);
    }
  };

  const FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
        <p className="text-muted-foreground mt-1">Review, create, and manage employee leave requests</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Requests */}
      {activeTab === "requests" && (
        <>
          <div className="flex gap-1 bg-slate-50 rounded-lg p-1 w-fit">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-5 h-20 bg-slate-100 rounded" />
                </Card>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarOff className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">No {filter} leave requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                return (
                  <Card key={req.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">{req.employee_name}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              {cfg.icon} {req.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-slate-700">{req.leave_type_name}</span>
                            {" · "}{formatDate(req.from_date)} → {formatDate(req.to_date)}
                            {" · "}<strong>{req.num_days} day{req.num_days !== 1 ? "s" : ""}</strong>
                          </p>
                          {req.reason && (
                            <p className="text-sm text-slate-500 mt-1 italic">&ldquo;{req.reason}&rdquo;</p>
                          )}
                        </div>
                        {req.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => handleReview(req.id, "approved")}
                              disabled={reviewing === req.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = window.prompt("Rejection reason (optional):");
                                handleReview(req.id, "rejected", reason || undefined);
                              }}
                              disabled={reviewing === req.id}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: Create Request */}
      {activeTab === "create" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Leave Request on Behalf of Employee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.employee_id}
                  onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.employee_code} — {emp.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Leave Type</Label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.leave_type_id}
                  onChange={(e) => setCreateForm({ ...createForm, leave_type_id: e.target.value })}
                >
                  <option value="">Select leave type…</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>From Date</Label>
                <Input type="date" value={createForm.from_date} onChange={(e) => setCreateForm({ ...createForm, from_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>To Date</Label>
                <Input type="date" value={createForm.to_date} onChange={(e) => setCreateForm({ ...createForm, to_date: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Reason (optional)</Label>
                <Input value={createForm.reason} onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })} placeholder="Medical, personal, etc." />
              </div>
            </div>

            {createError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{createError}</div>}
            {createResult && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{createResult}</div>}

            <Button onClick={handleCreateRequest} disabled={createLoading}>
              <Plus className="h-4 w-4 mr-2" />
              {createLoading ? "Creating…" : "Create Leave Request"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tab: Setup */}
      {activeTab === "setup" && (
        <div className="space-y-6">
          {/* Leave Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaveTypes.length > 0 && (
                <div className="space-y-2 mb-4">
                  {leaveTypes.map((lt) => (
                    <div key={lt.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
                      <div>
                        <p className="font-medium text-sm">{lt.name}</p>
                        <p className="text-xs text-muted-foreground">Code: {lt.code}</p>
                      </div>
                      <span className="text-sm font-mono bg-white px-2 py-1 rounded border">{lt.default_days_per_year} days/year</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input placeholder="Casual Leave" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input placeholder="CL" value={newType.code} onChange={(e) => setNewType({ ...newType, code: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Days/Year</Label>
                  <Input type="number" value={newType.default_days_per_year} onChange={(e) => setNewType({ ...newType, default_days_per_year: e.target.value })} />
                </div>
              </div>

              <Button size="sm" onClick={handleCreateType} disabled={setupLoading}>
                <Plus className="h-4 w-4 mr-2" /> Add Leave Type
              </Button>
            </CardContent>
          </Card>

          {/* Initialize Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Initialize Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Creates leave balance records for all active employees for the selected year.
              </p>
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Year</Label>
                  <Input type="number" className="w-28" value={initYear} onChange={(e) => setInitYear(e.target.value)} />
                </div>
                <Button onClick={handleInitBalances} disabled={setupLoading}>
                  {setupLoading ? "Initializing…" : "Initialize Balances"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {setupError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{setupError}</div>}
          {setupResult && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{setupResult}</div>}
        </div>
      )}
    </div>
  );
}
