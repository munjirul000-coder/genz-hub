"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export function AuthModal({ open, onClose, onSuccess, mode = "login" }: { open: boolean; onClose: () => void; onSuccess?: () => void; mode?: "login" | "signup" }) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, signup } = useAuth();

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (currentMode === "login") {
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Login failed");
        onSuccess?.();
        onClose();
        window.location.reload();
      } else {
        if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
        const r = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password, confirmPassword: form.confirmPassword }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Signup failed");
        onSuccess?.();
        onClose();
        window.location.reload();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-[16px] p-4 grid place-items-center" onClick={onClose}>
          <motion.div initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-[420px] bg-bg2 border border-border rounded-[20px] shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-7">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <Badge variant="gold" className="mb-3">FLASHVAULT • SECURE</Badge>
                  <h2 className="text-[22px] font-extrabold tracking-[-0.03em] leading-[1.1]">Sign in to continue</h2>
                  <p className="mt-2 text-[13px] text-muted leading-[1.5]">Your cart is saved. Login to checkout, wishlist & orders.</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full border border-border grid place-items-center hover:bg-bg3">✕</button>
              </div>

              <div className="space-y-4">
                {currentMode === "signup" && (
                  <div>
                    <label className="font-mono text-[11px] text-muted">FULL NAME *</label>
                    <Input className="mt-1.5" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="font-mono text-[11px] text-muted">EMAIL *</label>
                  <Input className="mt-1.5" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] text-muted">PASSWORD *</label>
                  <Input className="mt-1.5" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                {currentMode === "signup" && (
                  <div>
                    <label className="font-mono text-[11px] text-muted">CONFIRM PASSWORD *</label>
                    <Input className="mt-1.5" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
                    <p className="mt-1.5 font-mono text-[10px] text-muted">Min 8 chars, uppercase, lowercase, number</p>
                  </div>
                )}

                {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}

                <Button className="w-full rounded-pill h-[46px]" onClick={handleSubmit} disabled={loading}>
                  {loading ? "Please wait..." : currentMode === "login" ? "Login →" : "Create Account →"}
                </Button>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-[1px] flex-1 bg-border" />
                  <span className="font-mono text-[11px] text-muted">OR</span>
                  <div className="h-[1px] flex-1 bg-border" />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-pill h-[42px] text-[12px]" onClick={() => setCurrentMode(currentMode === "login" ? "signup" : "login")}>
                    {currentMode === "login" ? "Create account" : "Already have account? Login"}
                  </Button>
                  <Button variant="ghost" className="rounded-pill h-[42px] text-[12px]" onClick={onClose}>Continue browsing</Button>
                </div>

                <div className="pt-2 text-center">
                  <Link href="/forgot-password" className="font-mono text-[11px] text-muted hover:text-ink underline">Forgot password?</Link>
                </div>
              </div>
            </div>

            <div className="px-7 py-3 bg-bg3 border-t border-border font-mono text-[10px] text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Secure • Hashed passwords • httpOnly cookies • No plain text
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
