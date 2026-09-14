"use client";
import { useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
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
            <Badge variant="gold" className="w-fit mb-3">RESET PASSWORD</Badge>
            <CardTitle className="text-[22px]">Forgot password?</CardTitle>
            <CardDescription>Enter your email to get reset token (demo: token shown, prod would email)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="font-mono text-[11px] text-muted">EMAIL</label>
              <Input className="mt-1.5" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {error && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}
            {result && (
              <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-[12px] space-y-2">
                <div>Reset token generated:</div>
                <code className="block p-2 bg-white rounded border text-[11px] break-all">{result.resetToken}</code>
                <Link href={`/reset-password?token=${result.resetToken}`} className="text-emerald-700 font-bold underline">Go to reset page →</Link>
              </div>
            )}
            <Button className="w-full rounded-pill h-[46px]" onClick={submit} disabled={loading || !email}>{loading ? "..." : "Send reset token →"}</Button>
            <div className="text-center font-mono text-[11px]"><Link href="/login" className="underline">Back to login</Link></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
