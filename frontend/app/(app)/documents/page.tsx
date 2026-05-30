"use client";
import { useEffect, useState } from "react";
import { documentsApi, employeesApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Plus, FileText, Download, Edit2, RotateCcw,
  CheckCircle, HelpCircle, Eye, RefreshCw
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function DocumentsAdminPage() {
  const [activeTab, setActiveTab] = useState<"documents" | "templates">("documents");
  const [documents, setDocuments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueData, setIssueData] = useState({
    employee_id: "",
    template_id: "",
    type: "experience_letter",
    resignation_date: "",
    last_working_day: "",
  });

  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateHtml, setTemplateHtml] = useState("");

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInitialData = async () => {
    try {
      const [docsRes, tmplsRes, empsRes] = await Promise.all([
        documentsApi.list(),
        documentsApi.listTemplates(),
        employeesApi.list({ status: "active" }),
      ]);
      setDocuments(docsRes.data);
      setTemplates(tmplsRes.data);
      setEmployees(empsRes.data);
    } catch (err) {
      console.error("Failed to load documents data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleDownload = async (docId: string) => {
    setDownloadingId(docId);
    try {
      const res = await documentsApi.getDownloadUrl(docId);
      if (res.data.download_url) {
        window.open(res.data.download_url, "_blank");
      }
    } catch (err) {
      console.error("Failed to get download URL", err);
      alert("Error retrieving document PDF path.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    try {
      // Find template_id from type if not explicitly selected
      let selectedTmplId = issueData.template_id;
      if (!selectedTmplId) {
        const found = templates.find((t) => t.type === issueData.type);
        selectedTmplId = found?.id || "";
      }

      const meta: any = {};
      if (issueData.type === "relieving_letter" || issueData.type === "experience_letter") {
        meta.resignation_date = issueData.resignation_date;
        meta.last_working_day = issueData.last_working_day;
      }

      // 1. Create document draft
      const createRes = await documentsApi.create({
        employee_id: issueData.employee_id,
        template_id: selectedTmplId || null,
        type: issueData.type,
        metadata_json: meta,
      });

      // 2. Immediately issue to generate the PDF
      await documentsApi.issue(createRes.data.id, { metadata_json: meta });

      setShowIssueModal(false);
      setIssueData({ employee_id: "", template_id: "", type: "experience_letter", resignation_date: "", last_working_day: "" });
      fetchInitialData();
    } catch (err: any) {
      console.error("Failed to issue document", err);
      alert(err.response?.data?.detail || "Failed to generate and issue document");
    } finally {
      setIssuing(false);
    }
  };

  const handleEditTemplate = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setTemplateHtml(tmpl.template_html);
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      await documentsApi.updateTemplate(editingTemplate.id, {
        name: editingTemplate.name,
        type: editingTemplate.type,
        template_html: templateHtml,
        is_default: editingTemplate.is_default,
      });
      setEditingTemplate(null);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to save template", err);
      alert("Error saving custom template changes.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplates = async () => {
    if (confirm("Are you sure you want to restore default templates? This will overwrite any custom template HTML changes.")) {
      setLoading(true);
      try {
        await documentsApi.seedTemplates();
        fetchInitialData();
      } catch (err) {
        console.error("Failed to seed templates", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const getDocTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents & Letters</h1>
          <p className="text-muted-foreground mt-1">Generate experience certificates, relieving letters, and salary certificates for employees.</p>
        </div>

        <div className="flex gap-2 shrink-0">
          {activeTab === "templates" && (
            <button
              onClick={handleResetTemplates}
              className="inline-flex items-center justify-center rounded-md border bg-transparent px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </button>
          )}

          <button
            onClick={() => setShowIssueModal(true)}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Issue Letter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-colors ${activeTab === "documents" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Issued Letters
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-colors ${activeTab === "templates" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          HTML Template Editor
        </button>
      </div>

      {/* Tab Panel: Documents */}
      {activeTab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Issued Document Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <FileText className="h-10 w-10 text-slate-300" />
                <span>No letters have been issued to any employee yet.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 font-medium text-slate-700">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Document Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Issued At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-800">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{doc.employee_name}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">{getDocTypeLabel(doc.type)}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Issued
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{formatDate(doc.issued_at)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            disabled={downloadingId === doc.id}
                            onClick={() => handleDownload(doc.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border rounded-md px-2.5 py-1.5 shadow-sm transition-colors"
                          >
                            {downloadingId === doc.id ? (
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
      )}

      {/* Tab Panel: Templates */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col justify-between h-full min-h-[160px]">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{tmpl.name}</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full mt-1.5 inline-block">
                    {tmpl.type}
                  </span>
                  <p className="text-xs text-muted-foreground mt-3">Tailwind-styled Jinja2 HTML layout. Customizable.</p>
                </div>

                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleEditTemplate(tmpl)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border text-slate-700 px-3 py-2 rounded-md transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Customize HTML
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals: Issue Letter */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Issue Professional Letter</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleIssueSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Select Employee</Label>
                  <select
                    id="employee_id"
                    name="employee_id"
                    value={issueData.employee_id}
                    onChange={(e) => setIssueData({ ...issueData, employee_id: e.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Choose active employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Letter Type</Label>
                  <select
                    id="type"
                    name="type"
                    value={issueData.type}
                    onChange={(e) => setIssueData({ ...issueData, type: e.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="experience_letter">Experience Letter</option>
                    <option value="relieving_letter">Relieving Letter</option>
                    <option value="salary_certificate">Salary Certificate</option>
                  </select>
                </div>

                {/* Conditional fields for Exits */}
                {(issueData.type === "relieving_letter" || issueData.type === "experience_letter") && (
                  <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="resignation_date">Resignation Date</Label>
                      <Input
                        type="date"
                        id="resignation_date"
                        value={issueData.resignation_date}
                        onChange={(e) => setIssueData({ ...issueData, resignation_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_working_day">Last Working Day</Label>
                      <Input
                        type="date"
                        id="last_working_day"
                        value={issueData.last_working_day}
                        onChange={(e) => setIssueData({ ...issueData, last_working_day: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issuing}
                    className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 min-w-[100px]"
                  >
                    {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate & Issue"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Customize Template */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl shadow-2xl h-[90vh] flex flex-col justify-between">
            <CardHeader className="border-b shrink-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Customize HTML: {editingTemplate.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Use standard CSS styles. Supports Jinja2 fields: {'{{ employee.full_name }}'}, {'{{ org.name }}'}, {'{{ joining_date }}'}, {'{{ lworking_date }}'}.</p>
              </div>
              <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </CardHeader>
            <CardContent className="p-6 flex-1 overflow-y-auto">
              <div className="h-full flex flex-col">
                <textarea
                  value={templateHtml}
                  onChange={(e) => setTemplateHtml(e.target.value)}
                  className="w-full flex-1 font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-md focus:outline-none resize-none overflow-y-auto leading-normal min-h-[300px]"
                />
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 border-t shrink-0">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 min-w-[120px]"
              >
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Custom Layout"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
