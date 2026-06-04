"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Cookies from "js-cookie";
import axios from "axios";
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/password-validator";

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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });

    if (name === "admin_password") {
      const validation = validatePassword(value);
      setPasswordStrength(validation.score);
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "org_name"
        ? {
            org_slug: value
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, ""),
          }
        : {}),
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.org_name?.trim()) {
      errors.org_name = "Organisation name is required";
    }

    if (!form.org_slug?.trim()) {
      errors.org_slug = "Workspace URL slug is required";
    }

    if (!form.admin_full_name?.trim()) {
      errors.admin_full_name = "Full name is required";
    }

    if (!form.admin_email?.trim()) {
      errors.admin_email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) {
      errors.admin_email = "Invalid email format";
    }

    if (!form.admin_password) {
      errors.admin_password = "Password is required";
    } else {
      const validation = validatePassword(form.admin_password);
      if (!validation.valid) {
        errors.admin_password = `Password must contain: ${validation.unmetRequirements.join(", ")}`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      setError("Please fix the errors below");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.register(form);
      Cookies.set("access_token", res.data.access_token, {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      });
      router.push("/dashboard");
    } catch (err) {
      let errorMsg = "Registration failed. Please try again.";

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 400) {
          if (detail?.includes("slug")) {
            errorMsg = "This workspace URL is already taken. Please try another.";
          } else if (detail?.includes("Email")) {
            errorMsg = "This email is already registered. Please sign in instead.";
          } else {
            errorMsg = detail || "Invalid input. Please check your entries.";
          }
        } else if (status === 422) {
          errorMsg = "Please check all fields are filled correctly.";
        } else if (status && status >= 500) {
          errorMsg = "Server error. Please try again later.";
        } else if (!err.response) {
          errorMsg = "Network error. Please check your internet connection.";
          console.error("Network error during registration:", err.message);
        } else {
          errorMsg = "Something went wrong. Please try again.";
        }
      } else {
        console.error("Unexpected error during registration:", err);
        errorMsg = "An unexpected error occurred. Please try again.";
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const passwordValidation = validatePassword(form.admin_password);

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
            {/* Organisation Name */}
            <div className="space-y-2">
              <Label htmlFor="org_name">Organisation Name</Label>
              <Input
                id="org_name"
                name="org_name"
                placeholder="Acme Consulting"
                value={form.org_name}
                onChange={handleChange}
                required
                className={formErrors.org_name ? "border-red-500" : ""}
                aria-label="Organization name"
                aria-describedby={formErrors.org_name ? "org_name_error" : undefined}
              />
              {formErrors.org_name && (
                <p id="org_name_error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.org_name}
                </p>
              )}
            </div>

            {/* Workspace Slug */}
            <div className="space-y-2">
              <Label htmlFor="org_slug">Workspace URL slug</Label>
              <Input
                id="org_slug"
                name="org_slug"
                placeholder="acme-consulting"
                value={form.org_slug}
                onChange={handleChange}
                required
                className={formErrors.org_slug ? "border-red-500" : ""}
                aria-label="Workspace URL slug"
                aria-describedby={formErrors.org_slug ? "org_slug_error" : "org_slug_hint"}
              />
              <p id="org_slug_hint" className="text-xs text-muted-foreground">
                Only lowercase letters, numbers and hyphens
              </p>
              {formErrors.org_slug && (
                <p id="org_slug_error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.org_slug}
                </p>
              )}
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="admin_full_name">Your Full Name</Label>
              <Input
                id="admin_full_name"
                name="admin_full_name"
                placeholder="John Smith"
                value={form.admin_full_name}
                onChange={handleChange}
                required
                className={formErrors.admin_full_name ? "border-red-500" : ""}
                aria-label="Full name"
                aria-describedby={formErrors.admin_full_name ? "admin_full_name_error" : undefined}
              />
              {formErrors.admin_full_name && (
                <p id="admin_full_name_error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.admin_full_name}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="admin_email">Work Email</Label>
              <Input
                id="admin_email"
                name="admin_email"
                type="email"
                placeholder="you@company.com"
                value={form.admin_email}
                onChange={handleChange}
                required
                className={formErrors.admin_email ? "border-red-500" : ""}
                aria-label="Work email"
                aria-describedby={formErrors.admin_email ? "admin_email_error" : undefined}
              />
              {formErrors.admin_email && (
                <p id="admin_email_error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.admin_email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="admin_password">Password</Label>
              <Input
                id="admin_password"
                name="admin_password"
                type="password"
                placeholder="Min 12 characters with complexity"
                value={form.admin_password}
                onChange={handleChange}
                required
                minLength={12}
                className={formErrors.admin_password ? "border-red-500" : ""}
                aria-label="Admin password"
                aria-describedby={
                  formErrors.admin_password
                    ? "admin_password_error"
                    : form.admin_password
                      ? "password_strength"
                      : "password_hint"
                }
              />
              {formErrors.admin_password && (
                <p id="admin_password_error" className="text-sm text-destructive flex items-center gap-1" role="alert">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.admin_password}
                </p>
              )}

              {/* Password Strength Meter */}
              {form.admin_password && (
                <div id="password_strength" className="space-y-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Strength: {getPasswordStrengthLabel(passwordStrength)}
                  </p>
                  {passwordValidation.unmetRequirements.length > 0 ? (
                    <div className="space-y-1">
                      {passwordValidation.unmetRequirements.map((req) => (
                        <p key={req} className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Missing: {req}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      All requirements met!
                    </p>
                  )}
                </div>
              )}
              {!form.admin_password && (
                <p id="password_hint" className="text-xs text-muted-foreground">
                  Requires: 12+ characters, uppercase, lowercase, number, special character
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 flex items-gap-2" role="alert">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 mr-2" />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Workspace
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
