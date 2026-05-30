"use client";
import { useEffect, useState } from "react";
import { payrollApi, payslipsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Play, Lock, Download, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, MONTHS } from "@/lib/utils";

interface Payslip {
  id: string;
  employee_name: string;
  employee_code: string;
  designation: string | null;
  days_present: number;
  lop_days: number;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  is_pdf_generated: boolean;
}

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  payslips: Payslip[];
}

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await payrollApi.listRuns();
      setRuns(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRuns(); }, []);

  const handleRunPayroll = async () => {
    setRunning(true); setError(null);
    try {
      await payrollApi.createRun({ month, year });
      fetchRuns();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to run payroll.");
    } finally { setRunning(false); }
  };

  const handleLock = async (runId: string) => {
    await payrollApi.lockRun(runId);
    fetchRuns();
  };

  const handleGenerateAll = async (runId: string) => {
    setGeneratingPdf(runId);
    try {
      await payslipsApi.generateAll(runId);
      fetchRuns();
    } finally { setGeneratingPdf(null); }
  };

  const handleDownloadZip = async (runId: string, runLabel: string) => {
    const res = await payslipsApi.downloadZip(runId);
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslips_${runLabel}.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadSingle = async (payslipId: string) => {
    const res = await payslipsApi.getDownloadUrl(payslipId);
    window.open(res.data.download_url, "_blank");
  };

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    processed: "bg-blue-100 text-blue-800",
    locked: "bg-green-100 text-green-800",
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
        <p className="text-muted-foreground mt-1">Run and manage monthly payroll</p>
      </div>

      {/* Run Payroll Panel */}
      <Card>
        <CardHeader><CardTitle>Run Payroll</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <Button onClick={handleRunPayroll} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {running ? "Processing…" : "Run Payroll"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </CardContent>
      </Card>

      {/* Payroll Runs List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-24 bg-slate-100 rounded" />
            </Card>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No payroll runs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Select a month and year and click &ldquo;Run Payroll&rdquo;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => {
            const label = `${MONTHS[run.month - 1]} ${run.year}`;
            const isExpanded = expandedRun === run.id;
            return (
              <Card key={run.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{label}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[run.status] || ""}`}>
                          {run.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Gross</p>
                        <p className="font-semibold">{formatCurrency(run.total_gross)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Deductions</p>
                        <p className="font-semibold text-red-600">-{formatCurrency(run.total_deductions)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Net Pay</p>
                        <p className="font-bold text-green-700 text-base">{formatCurrency(run.total_net)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.status !== "locked" && (
                        <Button size="sm" variant="outline" onClick={() => handleLock(run.id)}>
                          <Lock className="h-3.5 w-3.5 mr-1" /> Lock
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateAll(run.id)}
                        disabled={generatingPdf === run.id}
                      >
                        {generatingPdf === run.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <FileText className="h-3.5 w-3.5 mr-1" />}
                        Generate PDFs
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadZip(run.id, label)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download ZIP
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Payslips Table */}
                  {isExpanded && run.payslips && run.payslips.length > 0 && (
                    <div className="mt-4 border-t pt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {["Employee", "Code", "Present", "LOP", "Gross", "Deductions", "Net Pay", "PDF"].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {run.payslips.map((ps) => (
                            <tr key={ps.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5 font-medium">{ps.employee_name}</td>
                              <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{ps.employee_code}</td>
                              <td className="px-3 py-2.5 text-center">{ps.days_present}</td>
                              <td className="px-3 py-2.5 text-center text-red-600">{ps.lop_days}</td>
                              <td className="px-3 py-2.5">{formatCurrency(ps.gross_earnings)}</td>
                              <td className="px-3 py-2.5 text-red-600">-{formatCurrency(ps.total_deductions)}</td>
                              <td className="px-3 py-2.5 font-semibold text-green-700">{formatCurrency(ps.net_pay)}</td>
                              <td className="px-3 py-2.5">
                                {ps.is_pdf_generated ? (
                                  <button
                                    onClick={() => handleDownloadSingle(ps.id)}
                                    className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" /> Download
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not generated</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
