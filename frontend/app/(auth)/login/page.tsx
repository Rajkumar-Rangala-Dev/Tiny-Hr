"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Loader2, AlertCircle } from "lucide-react";
import axios from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate inputs
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === "employee") {
        router.push("/me/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      let errorMsg = "Login failed. Please check your credentials.";

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 401) {
          errorMsg = "Invalid email or password";
        } else if (status === 403) {
          errorMsg = "Your account has been deactivated";
        } else if (status === 429) {
          errorMsg = "Too many login attempts. Please try again later.";
        } else if (!err.response) {
          errorMsg = "Network error. Please check your internet connection.";
          console.error("Network error during login:", err.message);
        } else if (status && status >= 500) {
          errorMsg = "Server error. Please try again later.";
        } else {
          errorMsg = detail || "Login failed. Please try again.";
        }
      } else {
        console.error("Unexpected error during login:", err);
        errorMsg = "An unexpected error occurred. Please try again.";
      }

      setError(errorMsg);
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
          <CardTitle className="text-2xl">Tiny HR</CardTitle>
          <CardDescription>Sign in to your organisation&apos;s workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Work email"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Password"
                disabled={loading}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 flex items-gap-2" role="alert">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 mr-2" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            New organisation?{" "}
            <a href="/register" className="text-primary hover:underline font-medium">
              Register here
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
