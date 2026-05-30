"use client";
import { useEffect, useState } from "react";
import { attendanceApi, employeesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, Eye, Send, FileText, PenLine } from "lucide-react";

interface PreviewRow {
  employee_code: string;
  employee_name: string;
  date: string;
  status: string;
  action: string;
  warning?: string;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

interface PreviewResponse {
  total_rows: number;
  valid_rows: number;
  warnings: number;
  errors: number;
  preview: PreviewRow[];
  error_details: string[];
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  half_day: "bg-yellow-100 text-yellow-800",
  work_from_home: "bg-blue-100 text-blue-800",
  on_leave: "bg-purple-100 text-purple-800",
  holiday: "bg-slate-100 text-slate-700",
  week_off: "bg-slate-100 text-slate-700",
};

const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "work_from_home", label: "WFH" },
  { value: "on_leave", label: "On Leave" },
  { value: "holiday", label: "Holiday" },
  { value: "week_off", label: "Week Off" },
];

export default function AttendancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [loading, setLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual entry state
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [manualForm, setManualForm] = useState({ employee_id: "", date: "", status: "present" });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    employeesApi.list({ status: "active" }).then((res) => setEmployees(res.data)).catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(null); setError(null); setStep("upload"); }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const res = await attendanceApi.previewCsv(file);
      setPreview(res.data);
      setStep("preview");
    } catch {
      setError("Failed to parse CSV. Check the file format.");
    } finally { setLoading(false); }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const res = await attendanceApi.commitCsv(file);
      setCommitResult(`✓ ${res.data.committed} attendance records committed successfully.`);
      setStep("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Commit failed. Resolve errors first.");
    } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setPreview(null); setStep("upload"); setCommitResult(null); setError(null); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-muted-foreground mt-1">Upload client CSV to mark attendance for all employees</p>
      </div>

      {/* CSV Format Guide */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">Expected CSV Format</p>
              <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded block w-fit">
                employee_id, employee_name, date, status
              </code>
              <p className="text-xs text-blue-700 mt-1">
                Status values: <strong>Present, Absent, Half Day, WFH, Leave, Holiday, Week Off</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card>
        <CardHeader><CardTitle>Upload Attendance CSV</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600">{file ? file.name : "Click or drag CSV file here"}</p>
            <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </label>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {commitResult && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {commitResult}
            </div>
          )}

          <div className="flex gap-2">
            {file && step === "upload" && (
              <Button onClick={handlePreview} disabled={loading}>
                <Eye className="h-4 w-4 mr-2" />
                {loading ? "Parsing…" : "Preview CSV"}
              </Button>
            )}
            {step === "preview" && preview && preview.errors === 0 && (
              <Button onClick={handleCommit} disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Committing…" : `Commit ${preview.valid_rows} Records`}
              </Button>
            )}
            {(step === "preview" || step === "done") && (
              <Button variant="outline" onClick={reset}>Upload Another</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Preview ({preview.total_rows} rows)</CardTitle>
              <div className="flex gap-2 text-xs">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">✓ {preview.valid_rows} valid</span>
                {preview.warnings > 0 && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">⚠ {preview.warnings} warnings</span>}
                {preview.errors > 0 && <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">✗ {preview.errors} errors</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {preview.error_details.length > 0 && (
              <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Issues found:</p>
                {preview.error_details.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
                {preview.error_details.length > 5 && (
                  <p className="text-xs text-red-500 mt-1">…and {preview.error_details.length - 5} more</p>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {["Employee Code", "Name", "Date", "Status", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.preview.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.employee_code}</td>
                      <td className="px-4 py-2.5 font-medium">{row.employee_name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.date}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-700"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs ${row.action === "insert" ? "text-green-600" : "text-blue-600"}`}>
                          {row.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.preview.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Showing 50 of {preview.preview.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Attendance Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4" /> Mark Attendance Manually
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="manual_employee">Employee</Label>
              <select
                id="manual_employee"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualForm.employee_id}
                onChange={(e) => setManualForm({ ...manualForm, employee_id: e.target.value })}
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
              <Label htmlFor="manual_date">Date</Label>
              <Input
                id="manual_date"
                type="date"
                value={manualForm.date}
                onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual_status">Status</Label>
              <select
                id="manual_status"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualForm.status}
                onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {manualError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {manualError}
            </div>
          )}
          {manualResult && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {manualResult}
            </div>
          )}

          <Button
            disabled={manualLoading || !manualForm.employee_id || !manualForm.date}
            onClick={async () => {
              setManualLoading(true);
              setManualError(null);
              setManualResult(null);
              try {
                await attendanceApi.markManual({
                  employee_id: manualForm.employee_id,
                  date: manualForm.date,
                  status: manualForm.status,
                });
                const emp = employees.find((e) => e.id === manualForm.employee_id);
                setManualResult(`Attendance marked for ${emp?.full_name || "employee"} on ${manualForm.date}`);
                setManualForm({ ...manualForm, date: "" });
              } catch (err: unknown) {
                const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                setManualError(msg || "Failed to mark attendance.");
              } finally {
                setManualLoading(false);
              }
            }}
          >
            <PenLine className="h-4 w-4 mr-2" />
            {manualLoading ? "Saving…" : "Mark Attendance"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
