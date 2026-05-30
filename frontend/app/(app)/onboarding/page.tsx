"use client";
import { useEffect, useState } from "react";
import { onboardingApi, employeesApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Plus, ClipboardCheck, Settings, Check, Clock, User, Award, CheckCircle2
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function OnboardingAdminPage() {
  const [activeTab, setActiveTab] = useState<"tasks" | "templates">("tasks");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedSelectedEmpId] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Form for Template
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [templateData, setTemplateData] = useState({
    task_name: "",
    assigned_to: "employee",
    due_days_after_joining: 7,
  });

  const fetchData = async () => {
    try {
      const empsRes = await employeesApi.list({ status: "active" });
      const tmplsRes = await onboardingApi.listTemplates();
      setEmployees(empsRes.data);
      setTemplates(tmplsRes.data);
      if (empsRes.data.length > 0) {
        setSelectedSelectedEmpId(empsRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load onboarding dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
      setLoadingTasks(true);
      onboardingApi.listTasks({ employee_id: selectedEmpId })
        .then((res) => setTasks(res.data))
        .catch((err) => console.error("Error loading tasks", err))
        .finally(() => setLoadingTasks(false));
    } else {
      setTasks([]);
    }
  }, [selectedEmpId]);

  const handleToggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    try {
      await onboardingApi.updateTask(id, { status: newStatus });
      // Reload tasks
      const res = await onboardingApi.listTasks({ employee_id: selectedEmpId });
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to update task", err);
    }
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTemplate(true);
    try {
      await onboardingApi.createTemplate(templateData);
      const res = await onboardingApi.listTemplates();
      setTemplates(res.data);
      setShowAddTemplate(false);
      setTemplateData({ task_name: "", assigned_to: "employee", due_days_after_joining: 7 });
    } catch (err) {
      console.error("Failed to add template item", err);
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const getPercentComplete = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === "done").length;
    return Math.round((completed / tasks.length) * 100);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Onboarding Checklist</h1>
        <p className="text-muted-foreground mt-1">Manage and track onboarding tasks, deliverables, and training for new hires.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-colors ${activeTab === "tasks" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          New Hire Checklist Status
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-colors ${activeTab === "templates" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Company Checklist Template
        </button>
      </div>

      {/* Tab: Tasks Status */}
      {activeTab === "tasks" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Selector Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                Select New Hire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {employees.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">No active employees found.</div>
              ) : (
                <div className="space-y-1">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedSelectedEmpId(emp.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedEmpId === emp.id ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-slate-50 text-slate-700"}`}
                    >
                      <div className="truncate">{emp.full_name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{emp.employee_code} — {emp.designation}</div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist List */}
          <div className="lg:col-span-2 space-y-4">
            {selectedEmpId ? (
              <Card>
                <CardHeader className="border-b pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-blue-600" />
                      Onboarding Tasks Status
                    </CardTitle>
                    {/* Progress Badge */}
                    <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 rounded-full px-2.5 py-1 text-xs font-bold font-mono">
                      {getPercentComplete()}% Complete ({tasks.filter((t) => t.status === "done").length}/{tasks.length})
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {loadingTasks ? (
                    <div className="flex py-12 justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No onboarding checklist generated for this employee. Initialize standard checklist items by recreating or triggering onboarding tasks.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task) => {
                        const isDone = task.status === "done";
                        return (
                          <div
                            key={task.id}
                            className={`flex items-start gap-4 p-4 border rounded-xl hover:border-slate-300 transition-colors ${isDone ? "bg-slate-50/50 border-slate-200" : "bg-white border-slate-200"}`}
                          >
                            {/* Checkbox button */}
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${isDone ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 hover:border-blue-500"}`}
                            >
                              {isDone && <Check className="h-3 w-3" />}
                            </button>

                            {/* Task Info */}
                            <div className="flex-1 space-y-1">
                              <p className={`text-sm font-semibold leading-normal ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                                {task.task_name}
                              </p>
                              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold capitalize ${task.assigned_to === "employee" ? "bg-teal-50 text-teal-700" : "bg-purple-50 text-purple-700"}`}>
                                  Assigned to: {task.assigned_to === "employee" ? "Employee" : "HR Staff"}
                                </span>
                                {task.due_date && (
                                  <span className="inline-flex items-center gap-1 font-medium font-mono text-slate-500">
                                    <Clock className="h-3 w-3" />
                                    Due: {formatDate(task.due_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground bg-slate-50 border rounded-lg">
                Please select an active employee from the left panel.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Seeded Induction Tasks Templates</h2>
            <button
              onClick={() => setShowAddTemplate(!showAddTemplate)}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Template Task
            </button>
          </div>

          {showAddTemplate && (
            <Card className="border-dashed bg-slate-50/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">New Template Checklist Item</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTemplateSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="task_name">Task Name / Deliverable</Label>
                    <Input
                      id="task_name"
                      placeholder="e.g. Upload signed non-disclosure agreement (NDA)"
                      value={templateData.task_name}
                      onChange={(e) => setTemplateData({ ...templateData, task_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assigned_to">Assigned Role</Label>
                      <select
                        id="assigned_to"
                        value={templateData.assigned_to}
                        onChange={(e) => setTemplateData({ ...templateData, assigned_to: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="employee">Employee Portal (Self-Service)</option>
                        <option value="hr">HR Administrator Staff</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="due_days_after_joining">Due Days After Joining</Label>
                      <Input
                        type="number"
                        id="due_days_after_joining"
                        value={templateData.due_days_after_joining}
                        onChange={(e) => setTemplateData({ ...templateData, due_days_after_joining: Number(e.target.value) })}
                        min={0}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddTemplate(false)}
                      className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingTemplate}
                      className="rounded-md bg-blue-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-blue-500 disabled:opacity-50"
                    >
                      {submittingTemplate ? "Adding…" : "Add to Template Checklist"}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col justify-between h-full min-h-[120px]">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug">{tmpl.task_name}</h3>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t mt-4 text-xs text-slate-500">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold capitalize ${tmpl.assigned_to === "employee" ? "bg-teal-50 text-teal-700" : "bg-purple-50 text-purple-700"}`}>
                      {tmpl.assigned_to === "employee" ? "Employee" : "HR Team"}
                    </span>
                    <span className="font-mono">Due: {tmpl.due_days_after_joining} days after joining</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
