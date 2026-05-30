"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { employeesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Upload, User, Building2, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  designation: string | null;
  department: string | null;
  date_of_joining: string | null;
  gross_salary: number;
  status: string;
  client_name: string | null;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const fetchEmployees = async (q = "") => {
    setLoading(true);
    try {
      const params: Record<string, string> = { status: "active" };
      if (q) params.search = q;
      const res = await employeesApi.list(params);
      setEmployees(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    fetchEmployees(e.target.value);
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await employeesApi.importCsv(file);
      const { created, skipped, errors } = res.data;
      setImportResult(`✓ Created: ${created}, Skipped: ${skipped}, Errors: ${errors.length}`);
      fetchEmployees();
    } catch {
      setImportResult("✗ Import failed. Check CSV format.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-muted-foreground mt-1">{employees.length} active employees</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild disabled={importing}>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importing…" : "Import CSV"}
              </span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </label>
          <Link href="/employees/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </Link>
        </div>
      </div>

      {importResult && (
        <div className={`text-sm p-3 rounded-lg border ${importResult.startsWith("✓") ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {importResult}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees…" className="pl-9" value={search} onChange={handleSearch} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-32 bg-slate-100 rounded" />
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No employees found</p>
            <p className="text-sm text-muted-foreground mt-1">Add employees manually or import via CSV</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Link key={emp.id} href={`/employees/${emp.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-mono">
                      {emp.employee_code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900">{emp.full_name}</h3>
                  {emp.designation && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Briefcase className="h-3 w-3" /> {emp.designation}
                    </p>
                  )}
                  {emp.department && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" /> {emp.department}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDate(emp.date_of_joining)}
                    </span>
                    {emp.client_name && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {emp.client_name}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
