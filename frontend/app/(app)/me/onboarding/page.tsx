"use client";
import { useEffect, useState } from "react";
import { onboardingApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Clock, ClipboardCheck, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function MyOnboardingPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyTasks = async () => {
    try {
      const res = await onboardingApi.listTasks();
      // Only show tasks assigned to "employee"
      const employeeTasks = res.data.filter((t: any) => t.assigned_to === "employee");
      setTasks(employeeTasks);
    } catch (err) {
      console.error("Failed to load onboarding tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const handleToggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    try {
      await onboardingApi.updateTask(id, { status: newStatus });
      fetchMyTasks();
    } catch (err) {
      console.error("Failed to update task", err);
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
        <h1 className="text-2xl font-bold text-slate-900">My Onboarding Checklist</h1>
        <p className="text-muted-foreground mt-1">Complete your assigned joining deliverables and induction tasks.</p>
      </div>

      {tasks.length === 0 ? (
        <Card className="text-center py-12 text-sm text-muted-foreground">
          <CardContent className="flex flex-col items-center gap-2 justify-center">
            <ClipboardCheck className="h-10 w-10 text-slate-300" />
            <span>No onboarding tasks found or assigned to you! You are fully set up.</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Checklist Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-blue-600" />
                  My Actions & Deliverables
                </CardTitle>
                <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 rounded-full px-2.5 py-1 text-xs font-bold font-mono">
                  {getPercentComplete()}% Complete
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {tasks.map((task) => {
                const isDone = task.status === "done";
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-4 p-4 border rounded-xl hover:border-slate-300 transition-colors ${isDone ? "bg-slate-50/50 border-slate-200" : "bg-white border-slate-200"}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTask(task.id, task.status)}
                      className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${isDone ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 hover:border-blue-500"}`}
                    >
                      {isDone && <Check className="h-3 w-3" />}
                    </button>

                    {/* Info */}
                    <div className="flex-1 space-y-1">
                      <p className={`text-sm font-semibold leading-normal ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {task.task_name}
                      </p>
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium font-mono">
                          <Clock className="h-3 w-3" />
                          Due: {formatDate(task.due_date)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick links card */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>For updates regarding bank details and physical address, please use the Profile tab:</p>
              
              <Link href="/me/profile" className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/20 border-blue-100 text-blue-700 font-semibold hover:bg-blue-50/50 transition-colors group">
                <span>Go to My Profile</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <div className="border-t pt-4 text-xs text-slate-400">
                Contact our HR team for any technical induction issues.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
