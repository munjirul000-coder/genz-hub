"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/db";

export default function MerchantPage() {
  const [form, setForm] = useState({
    brand: "",
    title: "",
    originalPrice: "",
    vaultPrice: "",
    stock: "",
    category: "Mens",
    merchantName: "",
    phone: "",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  const submit = async () => {
    const res = await fetch("/api/merchant/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        originalPrice: Number(form.originalPrice),
        vaultPrice: Number(form.vaultPrice),
        stock: Number(form.stock),
      }),
    });
    if (res.ok) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      const data = await res.json();
      setProducts((p) => [data.product, ...p]);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
        {/* Left — pitch */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <Badge variant="gold" className="mb-4">MERCHANT PORTAL</Badge>
          <h1 className="text-[36px] sm:text-[48px] font-extrabold tracking-[-0.04em] leading-[0.9]">
            Turn deadstock
            <br />
            <span className="font-serif italic font-normal">into cash</span> in 1 hour.
          </h1>
          <p className="mt-5 text-[15px] leading-[1.6] text-muted max-w-[44ch]">
            Factories, brands, wholesalers — submit your surplus. We curate 12-18 pieces per Friday drop, price to move, handle FOMO, bKash, Pathao, and payout in 48h after delivery.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              { t: "10% commission only", d: "You keep 90%. No listing fee, no monthly." },
              { t: "48h payout", d: "After courier confirms delivery, payout released automatically." },
              { t: "No photoshoot needed", d: "Phone photos OK. We enhance, background remove, vault-grade." },
            ].map((f) => (
              <div key={f.t} className="flex gap-4 p-4 rounded-lg border border-border bg-bg2 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-ink text-bg grid place-items-center text-[12px] font-bold">✓</div>
                <div>
                  <div className="font-bold text-[14px] tracking-[-0.01em]">{f.t}</div>
                  <div className="text-[13px] text-muted leading-[1.5] mt-1">{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <Card className="mt-8 rounded-lg">
            <CardHeader>
              <CardTitle className="text-[16px]">Your submissions</CardTitle>
              <CardDescription>{products.length} pieces in vault pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[320px] overflow-auto">
              {products.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center gap-3 border-b border-border last:border-0 py-2.5">
                  <img src={p.image} alt={p.title} className="w-10 h-12 rounded-md object-cover bg-bg3" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{p.title}</div>
                    <div className="text-[11px] font-mono text-muted">৳{p.vaultPrice} • {p.stock} pcs • {p.status}</div>
                  </div>
                  <Badge variant={p.status === "pending" ? "secondary" : p.status === "approved" ? "gold" : "default"} className="text-[9px]">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right — form */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <Card className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle className="text-[20px] tracking-[-0.02em]">Submit surplus lot</CardTitle>
              <CardDescription>Admin reviews in 2h. Approved → next Friday drop.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">BRAND / FACTORY</label>
                  <Input className="mt-2" placeholder="e.g. Yellow" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">CATEGORY</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]"
                  >
                    <option>Mens</option>
                    <option>Womens</option>
                    <option>Kids</option>
                    <option>Footwear</option>
                    <option>Accessories</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-mono text-[11px] tracking-wide text-muted">PRODUCT TITLE</label>
                <Input className="mt-2" placeholder="Handloom Cotton Panjabi — Surplus Lot" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">ORIGINAL PRICE (৳)</label>
                  <Input className="mt-2" type="number" placeholder="4500" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">VAULT PRICE (৳)</label>
                  <Input className="mt-2" type="number" placeholder="890" value={form.vaultPrice} onChange={(e) => setForm({ ...form, vaultPrice: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">STOCK PCS</label>
                  <Input className="mt-2" type="number" placeholder="42" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">YOUR NAME</label>
                  <Input className="mt-2" placeholder="Rafsan J." value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">PHONE (bKash)</label>
                  <Input className="mt-2" placeholder="017xxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={submit} className="w-full rounded-pill h-[48px]" disabled={!form.brand || !form.title || !form.phone}>
                  Submit to Vault →
                </Button>
                {submitted && <div className="mt-3 text-center text-[13px] font-medium text-emerald-600">✓ Submitted! Admin will review in 2h.</div>}
                <p className="mt-3 text-center font-mono text-[10px] text-muted">By submitting, you agree to 10% commission & 48h payout after delivery.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
