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
  const [products, setProducts] = useState<Product[]>([]);
  const [dropState, setDropState] = useState<any>(null);
  const [liveTraffic, setLiveTraffic] = useState(14230);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("Dhanmondi, Dhaka");
  const [city, setCity] = useState("Dhaka");
  const [customerName, setCustomerName] = useState("");
  const [ordered, setOrdered] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const load = async () => {
    try {
      const r = await fetch("/api/drop/status", { cache: "no-store" });
      const d = await r.json();
      setDropState(d.computed || d.drop);
      setLiveTraffic(d.drop?.liveTraffic || 14230);

      const rp = await fetch("/api/products", { cache: "no-store" });
      const dp = await rp.json();
      setProducts(dp.products || []);
      if (dp.drop?.computed) setDropState(dp.drop.computed);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    const trafficId = setInterval(() => setLiveTraffic((n) => n + Math.floor(Math.random() * 20) - 10), 5000);
    return () => {
      clearInterval(id);
      clearInterval(trafficId);
    };
  }, []);

  const isLive = dropState?.isLive || dropState?.state === "LIVE" || false;
  const isLocked = !isLive;

  const handleOrder = async () => {
    if (!selected) return;
    setCheckoutError("");
    setCheckoutLoading(true);
    const idempotencyKey = `order_${selected.id}_${phone}_${Date.now()}`;
    try {
      const r = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          quantity,
          customerPhone: phone,
          customerName,
          address,
          city,
          idempotencyKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setCheckoutError(d.error || "Order failed");
        setCheckoutLoading(false);
        return;
      }
      setOrderResult(d.order);
      setOrdered(true);
      // Refresh products to show updated stock
      setTimeout(() => {
        setShowCheckout(false);
        setSelected(null);
        setOrdered(false);
        setOrderResult(null);
        setPhone("");
        load();
      }, 3000);
    } catch (e: any) {
      setCheckoutError(e.message || "Network error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="sticky top-[72px] z-40 border-y border-border bg-bg2/80 backdrop-blur-xl">
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] h-[48px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
            <span className="font-mono text-[11px] tracking-[0.12em]">LIVE DROP • FRI 9PM • Asia/Dhaka</span>
            <Badge variant={isLive ? "gold" : "secondary"} className="ml-2">{dropState?.state || (isLive ? "LIVE" : "LOCKED")}</Badge>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{liveTraffic.toLocaleString()} ONLINE</span>
            <span className="text-muted">{products.length} VAULT PIECES • Server: {new Date(dropState?.serverTime || Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12">
        {isLocked ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[720px] mx-auto text-center py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 border border-border rounded-pill px-4 py-2 bg-bg2 shadow-sm"><span className="w-2 h-2 rounded-full bg-ink animate-pulse" /><span className="font-mono text-[11px] tracking-[0.12em]">VAULT IS LOCKED • Server-enforced</span></div>
            <h1 className="mt-8 text-[42px] sm:text-[64px] font-extrabold tracking-[-0.05em] leading-[0.9]">FRIDAY<br /><span className="font-serif italic font-normal">9PM</span> SHARP.</h1>
            <p className="mt-6 text-[16px] leading-[1.6] text-muted max-w-[48ch] mx-auto">
              Vault unlocks only for 1 hour based on <strong>server time Asia/Dhaka</strong>. Client clock manipulation blocked. Next drop: {dropState?.nextDropAt ? new Date(dropState.nextDropAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" }) : "Friday 9PM"}.
            </p>
            <div className="mt-6 p-4 rounded-lg bg-bg3 border text-[12px] font-mono text-muted text-left max-w-[480px] mx-auto">
              <div>Server State: {dropState?.state}</div>
              <div>Is Live: {String(dropState?.isLive)}</div>
              <div>Timezone: {dropState?.timezone || "Asia/Dhaka"}</div>
              <div>Server Time: {new Date(dropState?.serverTime || Date.now()).toString()}</div>
              {dropState?.liveEndsAt && <div>Live Ends: {new Date(dropState.liveEndsAt).toLocaleString()}</div>}
            </div>
            <div className="mt-8 flex justify-center gap-3"><Button className="rounded-pill" onClick={load}>Refresh Status</Button><Button variant="outline" className="rounded-pill" onClick={() => (window.location.href = "/")}>Back to Vault</Button></div>
            <p className="mt-6 font-mono text-[11px] text-muted">Admin can force unlock via /admin dashboard. No ?force=unlock bypass for customers.</p>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6 mb-8"><div><motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] sm:text-[44px] font-extrabold tracking-[-0.04em] leading-[0.9]">LIVE NOW — <span className="font-serif italic font-normal">60 MIN</span></motion.h1><p className="mt-3 text-muted text-[14px]">First come, vaulted forever. Real inventory lock • No overselling • bKash checkout.</p></div><Badge variant="gold" className="gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-goldDark animate-pulse" />LIVE • {liveTraffic.toLocaleString()} VIEWING</Badge></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">{products.map((p, i) => (<div key={p.id} onClick={() => setSelected(p)} className="cursor-pointer"><ProductCard p={p} index={i} /></div>))}</div>
            {products.length === 0 && <div className="text-center py-16 font-mono text-muted">No live products right now. Admin needs to approve products for this drop.</div>}
          </>
        )}
      </div>

      <AnimatePresence>{selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[12px] p-4 sm:p-8 grid place-items-center" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: "spring", damping: 24, stiffness: 300 }} className="w-full max-w-[920px] bg-bg2 border border-border rounded-xl sm:rounded-[22px] shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="grid md:grid-cols-[1.1fr_0.9fr]">
              <div className="relative aspect-[4/5] bg-bg3">
                <img src={selected.image} alt={selected.title} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 flex gap-2"><Badge variant="gold">-{selected.discountPercent}%</Badge><Badge variant="secondary">{selected.brand}</Badge></div>
                {selected.verificationStatus === "verified" && <div className="absolute bottom-4 left-4 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-pill">✓ VERIFIED</div>}
              </div>
              <div className="p-6 sm:p-8 flex flex-col">
                <div className="flex-1">
                  <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] leading-[1.15]">{selected.title}</h2>
                  <div className="mt-4 flex items-baseline gap-3"><span className="text-[28px] font-bold tracking-[-0.03em]">{formatBDT(selected.vaultPrice)}</span><span className="text-muted line-through">{formatBDT(selected.originalPrice)}</span><Badge variant="gold" className="ml-2">-{selected.discountPercent}% OFF</Badge></div>
                  {selected.description && <p className="mt-4 text-[13px] leading-[1.6] text-muted">{selected.description}</p>}
                  <div className="mt-6 space-y-3 text-[13px] leading-[1.6] text-ink2">
                    <div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Available</span><span className="font-mono font-bold">{selected.availableQuantity} pcs (real-time)</span></div>
                    <div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Sold</span><span className="font-mono">{selected.soldQuantity} sold</span></div>
                    <div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Category</span><span className="font-medium">{selected.category}</span></div>
                    <div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Condition</span><span className="font-medium">{selected.condition}</span></div>
                    <div className="flex justify-between py-2.5"><span className="text-muted">Delivery</span><span className="font-medium">{selected.deliveryInfo}</span></div>
                  </div>
                </div>
                <div className="mt-8 space-y-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-[12px] font-mono">QTY</span>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full border grid place-items-center">-</button>
                    <span className="font-bold w-6 text-center">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min(selected.availableQuantity, quantity + 1))} className="w-8 h-8 rounded-full border grid place-items-center">+</button>
                    <span className="ml-auto font-mono text-[11px] text-muted">Max {Math.min(5, selected.availableQuantity)} per order</span>
                  </div>
                  <Button size="lg" className="w-full rounded-pill h-[52px]" onClick={() => setShowCheckout(true)} disabled={!isLive || selected.availableQuantity === 0}>
                    {selected.availableQuantity === 0 ? "Sold Out" : `Buy with bKash — ${formatBDT(selected.vaultPrice * quantity)}`}
                  </Button>
                  <p className="text-center font-mono text-[10px] text-muted tracking-wide">Server-enforced • No overselling • Inventory locked on order</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{showCheckout && selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-[16px] p-4 grid place-items-center">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-[460px] bg-bg2 border border-border rounded-xl shadow-lg p-6 max-h-[90vh] overflow-auto">
            {!ordered ? (
              <>
                <h3 className="font-bold text-[18px] tracking-[-0.02em]">Secure Checkout</h3>
                <p className="mt-1 text-[13px] text-muted">{selected.title} x{quantity} — {formatBDT(selected.vaultPrice * quantity)}</p>

                <div className="mt-5 space-y-4">
                  <div><label className="font-mono text-[11px] tracking-wide text-muted">FULL NAME</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]" /></div>
                  <div><label className="font-mono text-[11px] tracking-wide text-muted">BKASH NUMBER *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017xxxxxxxx" className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]" /></div>
                  <div><label className="font-mono text-[11px] tracking-wide text-muted">ADDRESS *</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, Road, Area" className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]" /></div>
                  <div><label className="font-mono text-[11px] tracking-wide text-muted">CITY *</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Dhaka" className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]" /></div>
                </div>

                <div className="mt-4 p-3 rounded-md bg-bg3 border text-[11px] leading-[1.5]">
                  <div className="flex justify-between"><span>Subtotal ({quantity})</span><span>{formatBDT(selected.vaultPrice * quantity)}</span></div>
                  <div className="flex justify-between"><span>Delivery ({city.toLowerCase().includes("dhaka") ? "Inside Dhaka" : "Outside"})</span><span>{formatBDT(city.toLowerCase().includes("dhaka") ? 80 : 120)}</span></div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total</span><span>{formatBDT(selected.vaultPrice * quantity + (city.toLowerCase().includes("dhaka") ? 80 : 120))}</span></div>
                </div>

                {checkoutError && <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-[12px]">{checkoutError}</div>}

                <div className="mt-6 flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-pill" onClick={() => setShowCheckout(false)} disabled={checkoutLoading}>Cancel</Button>
                  <Button className="flex-1 rounded-pill" disabled={phone.length < 11 || address.length < 5 || checkoutLoading} onClick={handleOrder}>
                    {checkoutLoading ? "Processing..." : `Pay ${formatBDT(selected.vaultPrice * quantity + (city.toLowerCase().includes("dhaka") ? 80 : 120))}`}
                  </Button>
                </div>
                <p className="mt-3 text-center font-mono text-[10px] text-muted">Idempotency protected • No double charge • Inventory atomically reserved</p>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white grid place-items-center mx-auto text-[20px]">✓</div>
                <h3 className="mt-4 font-bold text-[18px]">Order Locked! {orderResult?.id}</h3>
                <p className="mt-2 text-[13px] text-muted">Amount: {formatBDT(orderResult?.totalAmount)} • Tracking: {orderResult?.courierTracking}</p>
                <p className="mt-1 text-[11px] font-mono text-muted">Pathao tracking will be updated. Inventory reserved.</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
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
