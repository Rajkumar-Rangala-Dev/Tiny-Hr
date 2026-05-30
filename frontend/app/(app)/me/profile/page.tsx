"use client";
import { useEffect, useState } from "react";
import { meApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, MapPin, CreditCard, Building2, Briefcase, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MyProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    phone: "",
    address: "",
    bank_account_number: "",
    bank_name: "",
    bank_ifsc: "",
    date_of_birth: "",
  });

  useEffect(() => {
    meApi.getProfile()
      .then((res) => {
        setProfile(res.data);
        setFormData({
          phone: res.data.phone || "",
          address: res.data.address || "",
          bank_account_number: res.data.bank_account_number || "",
          bank_name: res.data.bank_name || "",
          bank_ifsc: res.data.bank_ifsc || "",
          date_of_birth: res.data.date_of_birth || "",
        });
      })
      .catch((err) => setError("Failed to load profile details"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await meApi.updateProfile(formData);
      setProfile(res.data);
      setSuccess("Profile details updated successfully!");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update profile details");
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-muted-foreground mt-1">View and update your personal and banking information.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employment details Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-600" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center py-4 border-b">
              <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
                <User className="h-10 w-10" />
              </div>
              <h2 className="font-semibold text-lg text-slate-900">{profile?.full_name}</h2>
              <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full mt-1">
                {profile?.employee_code}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Designation</span>
                <span className="font-medium text-slate-900">{profile?.designation || "Not Set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium text-slate-900">{profile?.department || "Not Set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date of Joining</span>
                <span className="font-medium text-slate-900">{formatDate(profile?.date_of_joining)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PAN Number</span>
                <span className="font-medium text-slate-900 font-mono uppercase">{profile?.pan || "Not Set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UAN Number</span>
                <span className="font-medium text-slate-900 font-mono">{profile?.uan || "Not Set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Office Email</span>
                <span className="font-medium text-slate-900">{profile?.email || "Not Set"}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Client Alignment</span>
                <span className="font-medium text-blue-600">{profile?.client_name || "Internal Team"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit profile Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Personal & Banking Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg mb-4">{error}</div>}
            {success && <div className="text-sm text-green-600 bg-green-50 border border-green-200 p-3 rounded-lg mb-4">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Contact Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="pl-9" placeholder="10-digit mobile number" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="date" id="date_of_birth" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="pl-9" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Permanent Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea id="address" name="address" value={formData.address} onChange={handleChange} className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]" placeholder="Full physical address" />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  Banking Details (For Salary Disbursal)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="bank_name" name="bank_name" value={formData.bank_name} onChange={handleChange} className="pl-9" placeholder="e.g. HDFC Bank" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Account Number</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="bank_account_number" name="bank_account_number" value={formData.bank_account_number} onChange={handleChange} className="pl-9" placeholder="Account number" />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bank_ifsc">IFSC Code</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="bank_ifsc" name="bank_ifsc" value={formData.bank_ifsc} onChange={handleChange} className="pl-9 font-mono uppercase" placeholder="11-character alphanumeric code" maxLength={11} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 min-w-[120px]">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : "Save Details"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
