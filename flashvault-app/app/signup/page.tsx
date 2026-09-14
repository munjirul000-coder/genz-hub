"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = async () => {
    setError("");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push("/account");
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-12 grid place-items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[440px]">
          <Card className="rounded-[20px] shadow-md">
            <CardHeader>
              <Badge variant="gold" className="w-fit mb-3">JOIN VAULT</Badge>
              <CardTitle className="text-[24px] tracking-[-0.02em]">Create account</CardTitle>
              <CardDescription>Guest can browse, login required for checkout & orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="font-mono text-[11px] text-muted">FULL NAME *</label>
                <Input className="mt-1.5" placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="font-mono text-[11px] text-muted">EMAIL *</label>
                <Input className="mt-1.5" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="font-mono text-[11px] text-muted">PASSWORD *</label>
                <Input className="mt-1.5" type="password" placeholder="Min 8 chars, uppercase, lowercase, number" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="font-mono text-[11px] text-muted">CONFIRM PASSWORD *</label>
                <Input className="mt-1.5" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
              </div>
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}
              <Button className="w-full rounded-pill h-[46px]" onClick={submit} disabled={loading || !form.name || !form.email || !form.password}>
                {loading ? "Creating..." : "Create Account →"}
              </Button>
              <div className="text-center font-mono text-[11px] pt-2">
                <span className="text-muted">Already have account? </span><Link href="/login" className="font-bold hover:underline">Login</Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
