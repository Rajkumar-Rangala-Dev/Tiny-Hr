"use client";
import { useEffect, useState } from "react";
import { offboardingApi, employeesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, UserMinus, ShieldAlert, CheckCircle2, ClipboardList, HelpCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface OffboardingTask {
  id: string;
  offboarding_case_id: string;
  task_name: string;
  status: string;
  completed_at: string | null;
}

interface OffboardingCase {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  resignation_date: string;
  last_working_day: string;
  reason: string | null;
  status: string;
  final_settlement_amount: number;
  tasks: OffboardingTask[];
}

export default function OffboardingPage() {
  const [cases, setCases] = useState<OffboardingCase[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // New offboarding form
  const [form, setForm] = useState({
    employee_id: "",
    resignation_date: new Date().toISOString().split("T")[0],
    last_working_day: new Date().toISOString().split("T")[0],
    reason: "",
    final_settlement_amount: 0,
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCases = async () => {
    try {
      const res = await offboardingApi.list();
      setCases(res.data);
    } catch {
      setError("Failed to fetch offboarding cases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    employeesApi.list({ status: "active" })
      .then((res) => setEmployees(res.data))
      .catch(() => {});
  }, []);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await offboardingApi.initiate({
        ...form,
        final_settlement_amount: parseFloat(String(form.final_settlement_amount)) || 0,
      });
      setSuccess("Offboarding case initiated successfully.");
      setForm({
        employee_id: "",
        resignation_date: new Date().toISOString().split("T")[0],
        last_working_day: new Date().toISOString().split("T")[0],
        reason: "",
        final_settlement_amount: 0,
      });
      fetchCases();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to initiate offboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (task: OffboardingTask, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "pending" : "done";
    try {
      await offboardingApi.updateTask(task.id, { status: nextStatus });
      fetchCases();
    } catch (err: any) {
      setError("Failed to update task status.");
    }
  };

  const completeCase = async (caseId: string) => {
    if (!window.confirm("Complete offboarding? This will mark the employee as separated and auto-generate Experience and Relieving Letters.")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await offboardingApi.complete(caseId);
      setSuccess(res.data.message || "Offboarding completed successfully!");
      fetchCases();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to complete offboarding.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Offboarding & Separation</h1>
        <p className="text-muted-foreground mt-1">Manage employee exits, clearance checklists, and document issuance.</p>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Initiate Exit Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-red-600" />
              Initiate Employee Exit
            </CardTitle>
            <CardDescription>Start exit procedure and generate clearance task checklists</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInitiate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="employee_id">Exit Employee</Label>
                <select
                  id="employee_id"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  required
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} — {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resignation_date">Resignation Date</Label>
                <Input
                  id="resignation_date"
                  type="date"
                  value={form.resignation_date}
                  onChange={(e) => setForm({ ...form, resignation_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="last_working_day">Last Working Day</Label>
                <Input
                  id="last_working_day"
                  type="date"
                  value={form.last_working_day}
                  onChange={(e) => setForm({ ...form, last_working_day: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="final_settlement_amount">Settlement Amount (₹)</Label>
                <Input
                  id="final_settlement_amount"
                  type="number"
                  placeholder="0.00"
                  value={form.final_settlement_amount}
                  onChange={(e) => setForm({ ...form, final_settlement_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason for Exit</Label>
                <Input
                  id="reason"
                  placeholder="Personal reasons, career growth, etc."
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white" disabled={submitting || !form.employee_id}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initiating Exit…
                  </>
                ) : (
                  <>
                    <UserMinus className="h-4 w-4 mr-2" />
                    Initiate Exit
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Active Offboarding Cases */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" />
                Active Exit Cases
              </CardTitle>
              <CardDescription>Track clearance progress and complete final separations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cases.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <HelpCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  No active exit cases found.
                </div>
              ) : (
                <div className="divide-y border-t">
                  {cases.map((c) => {
                    const completedTasks = c.tasks.filter((t) => t.status === "done").length;
                    const totalTasks = c.tasks.length;
                    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    const isSelected = selectedCaseId === c.id;

                    return (
                      <div key={c.id} className="p-4 space-y-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                              {c.employee_name}
                              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                                {c.employee_code}
                              </span>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Last Day: <strong>{formatDate(c.last_working_day)}</strong> · Resigned: <strong>{formatDate(c.resignation_date)}</strong>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={c.status === "completed" ? "default" : "outline"} className={c.status === "completed" ? "bg-green-100 text-green-800" : "bg-blue-50 text-blue-700 border-blue-200"}>
                              {c.status}
                            </Badge>
                            <Badge variant="secondary">
                              {completedTasks}/{totalTasks} cleared
                            </Badge>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-slate-600">
                            <span>Clearance Checklist Completion</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        {/* Detail Trigger Toggle */}
                        <div className="flex justify-between items-center flex-wrap gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-600 hover:text-blue-500 px-0 h-fit"
                            onClick={() => setSelectedCaseId(isSelected ? null : c.id)}
                          >
                            {isSelected ? "Hide Checklist [-]" : "View Checklist & Manage Clearances [+]"}
                          </Button>

                          {c.status !== "completed" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-500 text-white h-7 text-xs font-bold"
                              disabled={completedTasks !== totalTasks}
                              onClick={() => completeCase(c.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Complete Separation
                            </Button>
                          )}
                        </div>

                        {/* Checklist Details */}
                        {isSelected && (
                          <div className="border rounded-lg bg-slate-50/50 p-4 space-y-3 mt-2 animate-in fade-in duration-200">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <ClipboardList className="h-3 w-3" />
                              Exiting Checklist Tasks (Click to check/uncheck)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {c.tasks.map((task) => (
                                <button
                                  key={task.id}
                                  onClick={() => toggleTask(task, task.status)}
                                  className={`flex items-start gap-2.5 text-left p-2.5 border rounded-lg hover:border-blue-400 hover:bg-white transition-all group ${task.status === "done" ? "border-green-100 bg-green-50/20" : "border-slate-100 bg-white"}`}
                                >
                                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all ${task.status === "done" ? "border-green-600 bg-green-600 text-white" : "border-slate-300 bg-white group-hover:border-blue-500"}`}>
                                    {task.status === "done" && <span className="text-[10px] leading-none">✓</span>}
                                  </span>
                                  <div>
                                    <p className={`text-xs font-medium leading-tight ${task.status === "done" ? "line-through text-slate-500" : "text-slate-800"}`}>
                                      {task.task_name}
                                    </p>
                                    {task.completed_at && (
                                      <p className="text-[10px] text-green-600 font-semibold mt-0.5">Cleared</p>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                            {progress < 100 && (
                              <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1 bg-amber-50 border border-amber-100 p-2 rounded-md">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                Please complete all clearance checklists across departments before clicking &quot;Complete Separation&quot;.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
