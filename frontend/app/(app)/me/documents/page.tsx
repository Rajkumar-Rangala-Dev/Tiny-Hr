"use client";
import { useEffect, useState } from "react";
import { meApi, documentsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Download, Send, RefreshCw, FileCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Document {
  id: string;
  template_id: string | null;
  type: string;
  status: string;
  requested_by: string | null;
  pdf_path: string | null;
  issued_at: string | null;
  metadata_json: Record<string, any>;
  created_at: string;
}

const DOCUMENT_TYPES = [
  { value: "salary_certificate", label: "Salary Certificate" },
  { value: "experience_letter", label: "Experience Certificate" },
  { value: "relieving_letter", label: "Relieving Letter" },
];

export default function MyDocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  
  // Request Form
  const [docType, setDocType] = useState("salary_certificate");
  const [purpose, setReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMyDocuments = async () => {
    try {
      const res = await meApi.getDocuments();
      setDocuments(res.data);
    } catch {
      setError("Failed to fetch documents list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyDocuments();
    }
  }, [user]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRequesting(true);
    try {
      await meApi.requestDocument({
        employee_id: user?.employee_id,
        type: docType,
        metadata_json: { purpose },
      });
      setSuccess("Document request submitted successfully.");
      setReason("");
      fetchMyDocuments();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit document request.");
    } finally {
      setRequesting(false);
    }
  };

  const downloadDoc = async (docId: string, filename: string) => {
    try {
      const res = await documentsApi.getDownloadUrl(docId);
      if (res.data.download_url) {
        window.open(res.data.download_url, "_blank");
      }
    } catch {
      setError("Failed to download document. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Letters & Documents</h1>
        <p className="text-muted-foreground mt-1">Request work certificates and download your issued company letters.</p>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Certificate Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-600" />
              Request Certificate
            </CardTitle>
            <CardDescription>Submit a formal request to HR for document issuance</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="doc_type">Document Type</Label>
                <select
                  id="doc_type"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  required
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="purpose">Reason / Purpose of Request</Label>
                <Input
                  id="purpose"
                  placeholder="e.g. Bank Loan, Rental Agreement, Visa application"
                  value={purpose}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white" disabled={requesting}>
                {requesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Request…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Request Document
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Issued and Requested Documents Log */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Letters & Documents Log
                </CardTitle>
                <CardDescription>View, track, or download your company-issued letters</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchMyDocuments} className="h-8">
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  No documents found or requested yet.
                </div>
              ) : (
                <div className="divide-y border-t">
                  {docs.map((d) => {
                    const docTypeLabel = DOCUMENT_TYPES.find((t) => t.value === d.type)?.label || d.type.replace("_", " ").toUpperCase();
                    const isIssued = d.status === "issued" || d.pdf_path;

                    return (
                      <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors gap-4">
                        <div className="space-y-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 text-sm truncate">{docTypeLabel}</h3>
                          <p className="text-xs text-muted-foreground">
                            Request: <strong>{formatDate(d.created_at)}</strong>
                            {d.issued_at && (
                              <> · Issued: <strong>{formatDate(d.issued_at)}</strong></>
                            )}
                          </p>
                          {d.metadata_json?.purpose && (
                            <p className="text-xs text-slate-500 truncate">
                              Purpose: <em>&quot;{d.metadata_json.purpose}&quot;</em>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${isIssued ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                            {isIssued ? "Issued" : d.status}
                          </span>
                          {isIssued && d.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-blue-600 hover:text-blue-500 bg-blue-50 hover:bg-blue-100 border-blue-200"
                              onClick={() => downloadDoc(d.id, `${d.type}_${d.id}.pdf`)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
