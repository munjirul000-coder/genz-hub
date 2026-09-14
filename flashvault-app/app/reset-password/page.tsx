"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ResetContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(search.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password, confirmPassword: confirm }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] py-12 grid place-items-center">
        <Card className="w-full max-w-[440px] rounded-[20px] shadow-md">
          <CardHeader>
            <Badge variant="gold" className="w-fit mb-3">RESET</Badge>
            <CardTitle className="text-[22px]">Set new password</CardTitle>
            <CardDescription>Token valid for 1 hour</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="font-mono text-[11px] text-muted">RESET TOKEN *</label>
              <Input className="mt-1.5" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste token" />
            </div>
            <div>
              <label className="font-mono text-[11px] text-muted">NEW PASSWORD *</label>
              <Input className="mt-1.5" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="font-mono text-[11px] text-muted">CONFIRM *</label>
              <Input className="mt-1.5" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}
            {success && <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px]">Password reset! Redirecting to login...</div>}
            <Button className="w-full rounded-pill h-[46px]" onClick={submit} disabled={loading || !token || !password}>{loading ? "..." : "Reset password →"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return <Suspense fallback={<div className="min-h-screen grid place-items-center">Loading...</div>}><ResetContent /></Suspense>;
}
