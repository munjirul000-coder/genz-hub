"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import type { Product } from "@/lib/db";

function DropContent() {
  const search = useSearchParams();
  const forceUnlock = search.get("force") === "unlock";
  const [products, setProducts] = useState<Product[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const [liveTraffic, setLiveTraffic] = useState(14230);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [phone, setPhone] = useState("");
  const [ordered, setOrdered] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products?.filter((p: Product) => p.status === "live" || p.status === "approved") ?? []);
        if (d.drop) {
          setIsLocked(forceUnlock ? false : d.drop.isLocked);
          setLiveTraffic(d.drop.liveTraffic);
        }
      });
    const id = setInterval(() => setLiveTraffic((n) => n + Math.floor(Math.random() * 20) - 10), 5000);
    return () => clearInterval(id);
  }, [forceUnlock]);

  const unlocked = !isLocked;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="sticky top-[72px] z-40 border-y border-border bg-bg2/80 backdrop-blur-xl">
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] h-[48px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-[11px] tracking-[0.12em]">LIVE DROP • FRI 9PM</span>
            <Badge variant={unlocked ? "gold" : "secondary"} className="ml-2">{unlocked ? "UNLOCKED" : "LOCKED"}</Badge>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{liveTraffic.toLocaleString()} ONLINE</span>
            <span className="text-muted">{products.length} VAULT PIECES</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12">
        {!unlocked ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[720px] mx-auto text-center py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 border border-border rounded-pill px-4 py-2 bg-bg2 shadow-sm"><span className="w-2 h-2 rounded-full bg-ink animate-pulse" /><span className="font-mono text-[11px] tracking-[0.12em]">VAULT IS LOCKED</span></div>
            <h1 className="mt-8 text-[42px] sm:text-[64px] font-extrabold tracking-[-0.05em] leading-[0.9]">FRIDAY<br /><span className="font-serif italic font-normal">9PM</span> SHARP.</h1>
            <p className="mt-6 text-[16px] leading-[1.6] text-muted max-w-[48ch] mx-auto">Vault unlocks only for 1 hour. Add <code className="bg-bg3 px-1.5 py-0.5 rounded text-[12px]">?force=unlock</code> to test.</p>
            <div className="mt-8 flex justify-center gap-3"><Button onClick={() => (window.location.href = "/drop?force=unlock")} className="rounded-pill">Test Unlock →</Button><Button variant="outline" className="rounded-pill" onClick={() => (window.location.href = "/")}>Back to Vault</Button></div>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6 mb-8"><div><motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] sm:text-[44px] font-extrabold tracking-[-0.04em] leading-[0.9]">LIVE NOW — <span className="font-serif italic font-normal">60 MIN</span></motion.h1><p className="mt-3 text-muted text-[14px]">First come, vaulted forever. bKash checkout, Pathao delivery.</p></div><Badge variant="gold" className="gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-goldDark animate-pulse" />LIVE • {liveTraffic.toLocaleString()} VIEWING</Badge></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">{products.map((p, i) => (<div key={p.id} onClick={() => setSelected(p)} className="cursor-pointer"><ProductCard p={p} index={i} /></div>))}</div>
          </>
        )}
      </div>

      <AnimatePresence>{selected && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[12px] p-4 sm:p-8 grid place-items-center" onClick={() => setSelected(null)}><motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: "spring", damping: 24, stiffness: 300 }} className="w-full max-w-[920px] bg-bg2 border border-border rounded-xl sm:rounded-[22px] shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}><div className="grid md:grid-cols-[1.1fr_0.9fr]"><div className="relative aspect-[4/5] bg-bg3"><img src={selected.image} alt={selected.title} className="w-full h-full object-cover" /><div className="absolute top-4 left-4 flex gap-2"><Badge variant="gold">-{Math.round(((selected.originalPrice - selected.vaultPrice) / selected.originalPrice) * 100)}%</Badge><Badge variant="secondary">{selected.brand}</Badge></div></div><div className="p-6 sm:p-8 flex flex-col"><div className="flex-1"><h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] leading-[1.15]">{selected.title}</h2><div className="mt-4 flex items-baseline gap-3"><span className="text-[28px] font-bold tracking-[-0.03em]">{formatBDT(selected.vaultPrice)}</span><span className="text-muted line-through">{formatBDT(selected.originalPrice)}</span></div><div className="mt-6 space-y-3 text-[13px] leading-[1.6] text-ink2"><div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Stock left</span><span className="font-mono font-bold">{selected.stock} pcs</span></div><div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Category</span><span className="font-medium">{selected.category}</span></div><div className="flex justify-between py-2.5"><span className="text-muted">Delivery</span><span className="font-medium">Pathao • 24h Dhaka</span></div></div></div><div className="mt-8 space-y-3"><Button size="lg" className="w-full rounded-pill h-[52px]" onClick={() => setShowCheckout(true)}>Buy with bKash — {formatBDT(selected.vaultPrice)}</Button><p className="text-center font-mono text-[10px] text-muted tracking-wide">VAULT: NO RETURN • NO RESTOCK • 1 HR ONLY</p></div></div></div></motion.div></motion.div>)}</AnimatePresence>

      <AnimatePresence>{showCheckout && selected && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-[16px] p-4 grid place-items-center"><motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-[420px] bg-bg2 border border-border rounded-xl shadow-lg p-6">{!ordered ? (<><h3 className="font-bold text-[18px] tracking-[-0.02em]">bKash Checkout</h3><p className="mt-1 text-[13px] text-muted">{selected.title} — {formatBDT(selected.vaultPrice)}</p><div className="mt-6"><label className="font-mono text-[11px] tracking-wide text-muted">BKASH NUMBER</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017xxxxxxxx" className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-ink" /></div><div className="mt-4 p-3 rounded-md bg-goldLight border border-gold/20 text-[12px] leading-[1.5]"><span className="font-bold">Demo:</span> Any number works. Payment simulated.</div><div className="mt-6 flex gap-2"><Button variant="outline" className="flex-1 rounded-pill" onClick={() => setShowCheckout(false)}>Cancel</Button><Button className="flex-1 rounded-pill" disabled={phone.length < 11} onClick={() => { setOrdered(true); setTimeout(() => { setShowCheckout(false); setSelected(null); setOrdered(false); }, 2000); }}>Pay {formatBDT(selected.vaultPrice)}</Button></div></>) : (<div className="text-center py-8"><div className="w-12 h-12 rounded-full bg-emerald-500 text-white grid place-items-center mx-auto text-[20px]">✓</div><h3 className="mt-4 font-bold text-[18px]">Order Locked!</h3><p className="mt-2 text-[13px] text-muted">Pathao tracking will be updated in Escrow manager.</p></div>)}</motion.div></motion.div>)}</AnimatePresence>
    </div>
  );
}

export default function DropPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center font-mono text-[13px]">Loading vault...</div>}>
      <DropContent />
    </Suspense>
  );
}
