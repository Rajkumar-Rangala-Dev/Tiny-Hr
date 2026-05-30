"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { employeesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    designation: "",
    department: "",
    date_of_joining: "",
    gross_salary: "",
    client_name: "",
    pan: "",
    uan: "",
    bank_account_number: "",
    bank_name: "",
    bank_ifsc: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_code || !form.full_name) {
      setError("Employee Code and Full Name are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        designation: form.designation || undefined,
        department: form.department || undefined,
        date_of_joining: form.date_of_joining || undefined,
        gross_salary: form.gross_salary ? parseFloat(form.gross_salary) : 0,
        client_name: form.client_name || undefined,
        pan: form.pan || undefined,
        uan: form.uan || undefined,
        bank_account_number: form.bank_account_number || undefined,
        bank_name: form.bank_name || undefined,
        bank_ifsc: form.bank_ifsc || undefined,
        address: form.address || undefined,
      };
      await employeesApi.create(payload);
      router.push("/employees");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to create employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Employee</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Fill in the details to create a new employee record</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employee_code">Employee Code *</Label>
              <Input id="employee_code" name="employee_code" placeholder="E001" value={form.employee_code} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input id="full_name" name="full_name" placeholder="John Doe" value={form.full_name} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="john@company.com" value={form.email} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+91 9876543210" value={form.phone} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" placeholder="Software Developer" value={form.designation} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" placeholder="Engineering" value={form.department} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_of_joining">Date of Joining</Label>
              <Input id="date_of_joining" name="date_of_joining" type="date" value={form.date_of_joining} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gross_salary">Gross Salary (₹)</Label>
              <Input id="gross_salary" name="gross_salary" type="number" placeholder="50000" value={form.gross_salary} onChange={handleChange} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="client_name">Client Name</Label>
              <Input id="client_name" name="client_name" placeholder="Client company (if deployed)" value={form.client_name} onChange={handleChange} />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Bank & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" name="pan" placeholder="ABCDE1234F" value={form.pan} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uan">UAN</Label>
              <Input id="uan" name="uan" placeholder="100123456789" value={form.uan} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input id="bank_name" name="bank_name" placeholder="HDFC Bank" value={form.bank_name} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank_account_number">Account Number</Label>
              <Input id="bank_account_number" name="bank_account_number" placeholder="12345678901234" value={form.bank_account_number} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank_ifsc">IFSC Code</Label>
              <Input id="bank_ifsc" name="bank_ifsc" placeholder="HDFC0001234" value={form.bank_ifsc} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" placeholder="Full address" value={form.address} onChange={handleChange} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Creating…" : "Create Employee"}
          </Button>
          <Link href="/employees">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
