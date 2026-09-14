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

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
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
          <Card className="rounded-[20px] shadow-md overflow-hidden">
            <CardHeader className="pb-4">
              <Badge variant="gold" className="w-fit mb-3">FLASHVAULT • CUSTOMER</Badge>
              <CardTitle className="text-[24px] tracking-[-0.02em]">Welcome back</CardTitle>
              <CardDescription>Login to access orders, wishlist & checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="font-mono text-[11px] text-muted">EMAIL</label>
                <Input className="mt-1.5" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="font-mono text-[11px] text-muted">PASSWORD</label>
                <Input className="mt-1.5" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}
              <Button className="w-full rounded-pill h-[46px]" onClick={submit} disabled={loading || !form.email || !form.password}>
                {loading ? "Logging in..." : "Login →"}
              </Button>
              <div className="flex justify-between pt-2 font-mono text-[11px]">
                <Link href="/forgot-password" className="text-muted hover:text-ink underline">Forgot password?</Link>
                <Link href="/signup" className="text-ink font-bold hover:underline">Create account →</Link>
              </div>
              <div className="pt-4 border-t border-border font-mono text-[10px] text-muted text-center">
                Secure • PBKDF2 hashed • httpOnly cookie • No plain text storage
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
