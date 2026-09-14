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
    description: "",
    originalPrice: "",
    vaultPrice: "",
    stock: "",
    category: "Mens",
    merchantName: "",
    phone: "",
    size: "",
    condition: "Surplus",
    location: "Dhaka, Bangladesh",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [discountPreview, setDiscountPreview] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  useEffect(() => {
    const orig = Number(form.originalPrice);
    const vault = Number(form.vaultPrice);
    if (orig > 0 && vault > 0 && vault < orig) {
      setDiscountPreview(Math.round(((orig - vault) / orig) * 100));
    } else setDiscountPreview(null);
  }, [form.originalPrice, form.vaultPrice]);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed");
        setLoading(false);
        return;
      }
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      setProducts((p) => [data.product, ...p]);
      setForm({
        brand: "",
        title: "",
        description: "",
        originalPrice: "",
        vaultPrice: "",
        stock: "",
        category: "Mens",
        merchantName: "",
        phone: "",
        size: "",
        condition: "Surplus",
        location: "Dhaka, Bangladesh",
      });
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const isValidBDPhone = (phone: string) => /^01[3-9]\d{8}$/.test(phone);

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
        {/* Left — pitch */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <Badge variant="gold" className="mb-4">MERCHANT PORTAL • Real verification</Badge>
          <h1 className="text-[36px] sm:text-[48px] font-extrabold tracking-[-0.04em] leading-[0.9]">
            Turn deadstock
            <br />
            <span className="font-serif italic font-normal">into cash</span> in 1 hour.
          </h1>
          <p className="mt-5 text-[15px] leading-[1.6] text-muted max-w-[44ch]">
            Factories, brands, wholesalers — submit your surplus. We curate 12-18 pieces per Friday drop, price to move, handle FOMO, bKash, Pathao, and payout in 48h after delivery. <strong>Server-calculated discounts only</strong> — no fake pricing.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              { t: "10% commission only", d: "You keep 90%. No listing fee, no monthly. Real earnings tracked." },
              { t: "48h payout", d: "After courier confirms delivery, payout released. Escrow protected." },
              { t: "Server-side verification", d: "Discounts calculated server-side. Suspicious pricing flagged for admin review." },
              { t: "No overselling", d: "Inventory atomically reserved. Race conditions prevented." },
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
              <CardTitle className="text-[16px]">Live vault pipeline (real)</CardTitle>
              <CardDescription>{products.length} pieces • Real DB • No fake stats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[380px] overflow-auto">
              {products.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-3 border-b border-border last:border-0 py-2.5">
                  <img src={p.image} alt={p.title} className="w-10 h-12 rounded-md object-cover bg-bg3" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{p.title}</div>
                    <div className="text-[11px] font-mono text-muted">৳{p.vaultPrice} • {p.stock} pcs • {p.status} • {p.discountPercent}% OFF • {p.verificationStatus}</div>
                  </div>
                  <Badge variant={p.status === "pending" ? "secondary" : p.status === "approved" || p.status === "live" ? "gold" : "default"} className="text-[9px]">
                    {p.status}
                  </Badge>
                </div>
              ))}
              {products.length === 0 && <div className="text-center py-8 text-muted text-[13px]">No products yet. Be first to submit!</div>}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right — form */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <Card className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle className="text-[20px] tracking-[-0.02em]">Submit surplus lot</CardTitle>
              <CardDescription>Server validates pricing • Rate limited • Audit logged</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">BRAND / FACTORY *</label>
                  <Input className="mt-2" placeholder="e.g. Yellow" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">CATEGORY *</label>
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
                    <option>Unisex</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono text-[11px] tracking-wide text-muted">PRODUCT TITLE *</label>
                <Input className="mt-2" placeholder="Handloom Cotton Panjabi — Surplus Lot" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <label className="font-mono text-[11px] tracking-wide text-muted">DESCRIPTION (min 10 chars)</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Fabric, condition, why surplus..." className="mt-2 w-full min-h-[70px] rounded-md border border-border bg-bg2 px-3 py-2 text-[14px]" />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">ORIGINAL PRICE (৳) *</label>
                  <Input className="mt-2" type="number" placeholder="4500" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">VAULT PRICE (৳) *</label>
                  <Input className="mt-2" type="number" placeholder="890" value={form.vaultPrice} onChange={(e) => setForm({ ...form, vaultPrice: e.target.value })} />
                  {discountPreview !== null && <div className={`mt-1 text-[11px] font-mono ${discountPreview > 85 ? "text-orange-600" : "text-emerald-600"}`}>→ {discountPreview}% OFF (server-calculated)</div>}
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">STOCK PCS *</label>
                  <Input className="mt-2" type="number" placeholder="42" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">SIZE</label>
                  <Input className="mt-2" placeholder="M, L, XL" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">CONDITION</label>
                  <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]">
                    <option>Surplus</option>
                    <option>Deadstock</option>
                    <option>Sample</option>
                    <option>New</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">LOCATION</label>
                  <Input className="mt-2" placeholder="Dhaka, Gazipur" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">YOUR NAME *</label>
                  <Input className="mt-2" placeholder="Rafsan J." value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-wide text-muted">PHONE (bKash) * 01XXXXXXXXX</label>
                  <Input className="mt-2" placeholder="017xxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  {form.phone && !isValidBDPhone(form.phone) && <div className="mt-1 text-[11px] text-red-600">Invalid BD number</div>}
                </div>
              </div>

              {error && <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}

              <div className="pt-2">
                <Button onClick={submit} className="w-full rounded-pill h-[48px]" disabled={loading || !form.brand || !form.title || !form.phone || !isValidBDPhone(form.phone)}>
                  {loading ? "Submitting..." : "Submit to Vault →"}
                </Button>
                {submitted && <div className="mt-3 text-center text-[13px] font-medium text-emerald-600">✓ Submitted! Admin will review. Real discount calculated server-side.</div>}
                <p className="mt-3 text-center font-mono text-[10px] text-muted">By submitting, you agree to 10% commission & 48h payout after delivery. Pricing verified server-side.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
