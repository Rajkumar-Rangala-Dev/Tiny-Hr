"use client";
import { useEffect, useState } from "react";
import { meApi, payslipsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";

export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    meApi.getPayslips()
      .then((res) => {
        setPayslips(res.data);
      })
      .catch((err) => console.error("Failed to load payslips", err))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (payslipId: string, month: number, year: number) => {
    setDownloadingId(payslipId);
    try {
      const res = await payslipsApi.getDownloadUrl(payslipId);
      const downloadUrl = res.data.download_url;
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
      } else {
        alert("Failed to fetch download link. Please check if PDF is generated.");
      }
    } catch (err) {
      console.error("Failed to download payslip", err);
      alert("Failed to download. Please try again later.");
    } finally {
      setDownloadingId(null);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Payslips</h1>
        <p className="text-muted-foreground mt-1">View and download your monthly salary statements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Salary Slips Log</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <FileText className="h-10 w-10 text-slate-300" />
              <span>No processed payslips found yet for your profile.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 font-medium text-slate-700">
                    <th className="py-3 px-4">Pay Period</th>
                    <th className="py-3 px-4">Working Days</th>
                    <th className="py-3 px-4">Leaves Taken</th>
                    <th className="py-3 px-4">Gross Earnings</th>
                    <th className="py-3 px-4">Total Deductions</th>
                    <th className="py-3 px-4">Net Take-Home</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {payslips.map((ps) => (
                    <tr key={ps.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {MONTHS[ps.month - 1]} {ps.year}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{ps.days_present} / {ps.working_days} days</td>
                      <td className="py-3.5 px-4 text-amber-700 font-semibold">{ps.leaves_taken || 0} {ps.leaves_taken === 1 ? "day" : "days"}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{formatCurrency(ps.gross_earnings)}</td>
                      <td className="py-3.5 px-4 text-red-600 font-medium">{formatCurrency(ps.total_deductions)}</td>
                      <td className="py-3.5 px-4 font-bold text-green-700">{formatCurrency(ps.net_pay)}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          Processed
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          disabled={downloadingId === ps.id}
                          onClick={() => handleDownload(ps.id, ps.month, ps.year)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border text-slate-700 rounded-md px-2.5 py-1.5 shadow-sm transition-colors disabled:opacity-50"
                        >
                          {downloadingId === ps.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Download PDF
                        </button>
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
