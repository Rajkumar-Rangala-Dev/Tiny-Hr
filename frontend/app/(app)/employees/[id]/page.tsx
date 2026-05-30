"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { employeesApi, attendanceApi, documentsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, CalendarCheck } from "lucide-react";
import Link from "next/link";

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  gross_salary: number;
  status: string;
  client_name: string | null;
  pan: string | null;
  uan: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_ifsc: string | null;
  address: string | null;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  half_day: number;
  work_from_home: number;
  on_leave: number;
  holiday: number;
  week_off: number;
  working_days: number;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  // Offboarding/Exit States
  const [exitForm, setExitForm] = useState({
    resignation_date: new Date().toISOString().split("T")[0],
    last_working_day: new Date().toISOString().split("T")[0],
  });
  const [offboarding, setOffboarding] = useState(false);
  const [letterGenerating, setLetterGenerating] = useState(false);
  const [letterStatus, setLetterStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await employeesApi.get(id);
        const emp = res.data;
        setEmployee(emp);
        setForm({
          full_name: emp.full_name || "",
          email: emp.email || "",
          phone: emp.phone || "",
          designation: emp.designation || "",
          department: emp.department || "",
          date_of_joining: emp.date_of_joining || "",
          gross_salary: String(emp.gross_salary || 0),
          client_name: emp.client_name || "",
          pan: emp.pan || "",
          uan: emp.uan || "",
          bank_account_number: emp.bank_account_number || "",
          bank_name: emp.bank_name || "",
          bank_ifsc: emp.bank_ifsc || "",
          address: emp.address || "",
        });

        const now = new Date();
        try {
          const attRes = await attendanceApi.getByEmployee(id, { month: now.getMonth() + 1, year: now.getFullYear() });
          const records = attRes.data;
          const summary: AttendanceSummary = { present: 0, absent: 0, half_day: 0, work_from_home: 0, on_leave: 0, holiday: 0, week_off: 0, working_days: records.length };
          records.forEach((r: { status: string }) => {
            if (r.status in summary) (summary as Record<string, number>)[r.status]++;
          });
          setAttendance(summary);
        } catch { /* no attendance data */ }
      } catch {
        setError("Employee not found.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([key, val]) => {
        if (key === "gross_salary") {
          payload[key] = parseFloat(val) || 0;
        } else if (val) {
          payload[key] = val;
        }
      });
      await employeesApi.update(id, payload);
      setSuccess("Employee updated successfully.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm("Are you sure you want to archive this employee?")) return;
    try {
      await employeesApi.archive(id);
      router.push("/employees");
    } catch {
      setError("Failed to archive employee.");
    }
  };

  const handleOffboard = async () => {
    if (!window.confirm("Are you sure you want to mark this employee as separated?")) return;
    setOffboarding(true);
    setError(null);
    setSuccess(null);
    try {
      await employeesApi.update(id, { status: "separated" });
      setEmployee((prev: any) => prev ? { ...prev, status: "separated" } : null);
      setSuccess("Employee officially marked as separated.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to offboard employee.");
    } finally {
      setOffboarding(false);
    }
  };

  const handleGenerateLetter = async (type: "experience_letter" | "relieving_letter") => {
    setLetterGenerating(true);
    setLetterStatus(null);
    try {
      // 1. Create document draft
      const createRes = await documentsApi.create({
        employee_id: id,
        type,
        metadata_json: {
          resignation_date: exitForm.resignation_date,
          last_working_day: exitForm.last_working_day,
        },
      });

      // 2. Issue document to render PDF
      const issueRes = await documentsApi.issue(createRes.data.id, {
        metadata_json: {
          resignation_date: exitForm.resignation_date,
          last_working_day: exitForm.last_working_day,
        },
      });

      // 3. Get download URL
      const dlRes = await documentsApi.getDownloadUrl(issueRes.data.id);
      if (dlRes.data.download_url) {
        setLetterStatus(`Letter generated!`);
        window.open(dlRes.data.download_url, "_blank");
      } else {
        setLetterStatus("Failed to get download link.");
      }
    } catch (err: any) {
      console.error(err);
      setLetterStatus(err.response?.data?.detail || "Failed to generate letter.");
    } finally {
      setLetterGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse" />
        <Card className="animate-pulse"><CardContent className="p-6 h-64 bg-slate-50" /></Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium text-slate-700">Employee not found</p>
        <Link href="/employees"><Button className="mt-4" variant="outline">Back to Employees</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/employees">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{employee.full_name}</h1>
            <p className="text-muted-foreground text-sm font-mono">{employee.employee_code} · {employee.status}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleArchive}>
          <Trash2 className="h-4 w-4 mr-1" /> Archive
        </Button>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{success}</div>}

      {/* Attendance Summary */}
      {attendance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> This Month&apos;s Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Present", value: attendance.present, color: "text-green-700 bg-green-50" },
                { label: "Absent", value: attendance.absent, color: "text-red-700 bg-red-50" },
                { label: "Half Day", value: attendance.half_day, color: "text-yellow-700 bg-yellow-50" },
                { label: "WFH", value: attendance.work_from_home, color: "text-blue-700 bg-blue-50" },
                { label: "On Leave", value: attendance.on_leave, color: "text-purple-700 bg-purple-50" },
                { label: "Holiday", value: attendance.holiday, color: "text-slate-700 bg-slate-100" },
                { label: "Week Off", value: attendance.week_off, color: "text-slate-700 bg-slate-100" },
                { label: "Total Records", value: attendance.working_days, color: "text-slate-700 bg-slate-100" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Employee Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input name="full_name" value={form.full_name} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input name="email" type="email" value={form.email} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input name="phone" value={form.phone} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input name="designation" value={form.designation} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input name="department" value={form.department} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Date of Joining</Label>
            <Input name="date_of_joining" type="date" value={form.date_of_joining} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Gross Salary (₹)</Label>
            <Input name="gross_salary" type="number" value={form.gross_salary} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Client Name</Label>
            <Input name="client_name" value={form.client_name} onChange={handleChange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bank & Compliance</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>PAN</Label>
            <Input name="pan" value={form.pan} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>UAN</Label>
            <Input name="uan" value={form.uan} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input name="bank_name" value={form.bank_name} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input name="bank_account_number" value={form.bank_account_number} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>IFSC Code</Label>
            <Input name="bank_ifsc" value={form.bank_ifsc} onChange={handleChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input name="address" value={form.address} onChange={handleChange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Employee Exit / Offboarding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Resignation Date</Label>
              <Input
                type="date"
                value={exitForm.resignation_date}
                onChange={(e) => setExitForm({ ...exitForm, resignation_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last Working Day (Exit Date)</Label>
              <Input
                type="date"
                value={exitForm.last_working_day}
                onChange={(e) => setExitForm({ ...exitForm, last_working_day: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
            {employee.status !== "separated" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleOffboard}
                disabled={offboarding}
                className="font-bold shadow-sm"
              >
                {offboarding ? "Processing…" : "Mark as Separated (Exit)"}
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={letterGenerating}
                  onClick={() => handleGenerateLetter("experience_letter")}
                  className="font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 shadow-xs flex-1"
                >
                  Generate Experience Letter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={letterGenerating}
                  onClick={() => handleGenerateLetter("relieving_letter")}
                  className="font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 shadow-xs flex-1"
                >
                  Generate Relieving Letter
                </Button>
              </div>
            )}
          </div>
          {letterStatus && (
            <p className="text-xs text-blue-600 font-semibold mt-1 bg-blue-50/50 border border-blue-100 p-2 rounded-md">{letterStatus}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
