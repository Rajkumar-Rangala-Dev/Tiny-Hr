"use client";
import { useEffect, useState } from "react";
import { orgApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Upload, Building2, Loader2 } from "lucide-react";

interface OrgSettings {
  name: string;
  registered_address: string;
  cin: string;
  gstin: string;
  pan: string;
  payslip_footer_text: string;
  watermark_opacity: number;
  working_days_per_month: number;
}

export default function SettingsPage() {
  const [form, setForm] = useState<OrgSettings>({
    name: "",
    registered_address: "",
    cin: "",
    gstin: "",
    pan: "",
    payslip_footer_text: "This is a system-generated payslip and does not require a signature.",
    watermark_opacity: 0.08,
    working_days_per_month: 26,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    orgApi.get().then((res) => {
      const d = res.data;
      setForm({
        name: d.name || "",
        registered_address: d.registered_address || "",
        cin: d.cin || "",
        gstin: d.gstin || "",
        pan: d.pan || "",
        payslip_footer_text: d.payslip_footer_text || "",
        watermark_opacity: d.watermark_opacity ?? 0.08,
        working_days_per_month: d.working_days_per_month ?? 26,
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true); setSuccess(null); setError(null);
    try {
      await orgApi.update({
        ...form,
        watermark_opacity: Number(form.watermark_opacity),
        working_days_per_month: Number(form.working_days_per_month),
      });
      setSuccess("Settings saved successfully.");
    } catch {
      setError("Failed to save settings.");
    } finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true); setError(null); setSuccess(null);
    try {
      await orgApi.uploadLogo(file);
      setSuccess("Logo uploaded successfully. It will appear on new payslips.");
    } catch {
      setError("Failed to upload logo.");
    } finally { setUploadingLogo(false); e.target.value = ""; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organisation Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your company details and payslip branding</p>
      </div>

      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{success}</div>}
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input name="name" value={form.name} onChange={handleChange} placeholder="Acme Consulting Pvt. Ltd." />
          </div>
          <div className="space-y-2">
            <Label>Registered Address</Label>
            <Input name="registered_address" value={form.registered_address} onChange={handleChange} placeholder="123 Main Street, City, State - 000000" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CIN</Label>
              <Input name="cin" value={form.cin} onChange={handleChange} placeholder="U12345MH2020PTC000000" />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input name="gstin" value={form.gstin} onChange={handleChange} placeholder="27AAAAA0000A1Z5" />
            </div>
            <div className="space-y-2">
              <Label>PAN</Label>
              <Input name="pan" value={form.pan} onChange={handleChange} placeholder="AAAAA0000A" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Working Days Per Month</Label>
            <Input name="working_days_per_month" type="number" value={form.working_days_per_month} onChange={handleChange} min={1} max={31} className="w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Payslip Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payslip Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <p className="text-xs text-muted-foreground">Used in payslip header and as watermark. PNG or JPG recommended.</p>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild disabled={uploadingLogo}>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? "Uploading…" : "Upload Logo"}
                </span>
              </Button>
              <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleLogoUpload} />
            </label>
          </div>

          {/* Footer Text */}
          <div className="space-y-2">
            <Label>Payslip Footer Text</Label>
            <Input
              name="payslip_footer_text"
              value={form.payslip_footer_text}
              onChange={handleChange}
              placeholder="This is a system-generated payslip…"
            />
          </div>

          {/* Watermark Opacity */}
          <div className="space-y-2">
            <Label>Watermark Opacity</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                name="watermark_opacity"
                min={0.03}
                max={0.2}
                step={0.01}
                value={form.watermark_opacity}
                onChange={handleChange}
                className="w-48"
              />
              <span className="text-sm text-muted-foreground w-12">{Math.round(Number(form.watermark_opacity) * 100)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Controls how visible the logo watermark is on payslips (3%–20%)</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}
