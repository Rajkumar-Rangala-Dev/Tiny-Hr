"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Loader2 } from "lucide-react";
import Cookies from "js-cookie";

export default function RegisterPage() {
  const [form, setForm] = useState({
    org_name: "",
    org_slug: "",
    admin_full_name: "",
    admin_email: "",
    admin_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "org_name"
        ? { org_slug: value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") }
        : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register(form);
      Cookies.set("access_token", res.data.access_token, { expires: 1 });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-primary rounded-xl p-3">
              <Briefcase className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Create Organisation</CardTitle>
          <CardDescription>Set up your Tiny HR workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Organisation Name</Label>
              <Input name="org_name" placeholder="Acme Consulting" value={form.org_name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label>Workspace URL slug</Label>
              <Input name="org_slug" placeholder="acme-consulting" value={form.org_slug} onChange={handleChange} required />
              <p className="text-xs text-muted-foreground">Only lowercase letters, numbers and hyphens</p>
            </div>
            <div className="space-y-2">
              <Label>Your Full Name</Label>
              <Input name="admin_full_name" placeholder="John Smith" value={form.admin_full_name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label>Work Email</Label>
              <Input name="admin_email" type="email" placeholder="you@company.com" value={form.admin_email} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input name="admin_password" type="password" placeholder="Min 8 characters" value={form.admin_password} onChange={handleChange} required minLength={8} />
            </div>
            {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Workspace
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline font-medium">Sign in</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
