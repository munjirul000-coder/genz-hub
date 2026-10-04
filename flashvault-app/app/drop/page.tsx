"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { AuthModal } from "@/components/auth-modal";
import { CheckoutModal } from "@/components/checkout-modal";

function DropContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dropState, setDropState] = useState<any>(null);
  const [liveTraffic, setLiveTraffic] = useState(14230);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [justWentLive, setJustWentLive] = useState(false);
  const wasLiveRef = useRef(false);

  const { user } = useAuth();
  const { add: addToCart, items: cartItems } = useCart();

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

  // Vault went LIVE while page is open -> celebration + browser tab alert
  const resolvedOnceRef = useRef(false);
  useEffect(() => {
    if (!dropState) return;
    if (!resolvedOnceRef.current) {
      // first status resolution: record only, no celebration (banner already shows live state)
      resolvedOnceRef.current = true;
      wasLiveRef.current = isLive;
      return;
    }
    if (isLive && !wasLiveRef.current) {
      // real locked -> live transition while page open: celebrate!
      wasLiveRef.current = true;
      setJustWentLive(true);
      const t = setTimeout(() => setJustWentLive(false), 4500);
      return () => clearTimeout(t);
    }
    wasLiveRef.current = isLive;
  }, [isLive, dropState]);

  // Browser tab shows LIVE status so everyone notices even from another tab
  useEffect(() => {
    if (!isLive) return;
    document.title = "🔴 LIVE NOW — FlashVault BD";
    const id = setInterval(() => {
      document.title = document.title.includes("🔴") ? "🔥 VAULT OPEN — 60 MIN" : "🔴 LIVE NOW — FlashVault BD";
    }, 1600);
    return () => {
      clearInterval(id);
      document.title = "Live Drop | FlashVault BD";
    };
  }, [isLive]);

  const handleAddToCart = (p: Product) => {
    addToCart({ id: p.id, title: p.title, brand: p.brand, vaultPrice: p.vaultPrice, originalPrice: p.originalPrice, image: p.image }, quantity);
  };

  const handleBuyClick = () => {
    if (!user) {
      setAuthMode("login");
      setShowAuthModal(true);
      return;
    }
    setShowCheckout(true);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      {/* Status bar — mobile: normal document flow, auto height, wraps to 2 lines without overlapping; sm+: sticky exactly as before */}
      <div className="sm:sticky sm:top-[72px] sm:z-40 border-y border-border bg-bg2/80 backdrop-blur-xl">
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] min-h-[48px] py-2 sm:py-0 sm:h-[48px] flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
            <span className="font-mono text-[11px] tracking-[0.12em]">LIVE DROP • FRI 9PM • Asia/Dhaka</span>
            <Badge variant={isLive ? "gold" : "secondary"} className="ml-2 shrink-0">{dropState?.state || (isLive ? "LIVE" : "LOCKED")}</Badge>
            {user && <Badge variant="secondary" className="hidden sm:flex text-[10px]">✓ {user.name?.split(" ")[0]} logged in</Badge>}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 font-mono text-[11px]">
            <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{liveTraffic.toLocaleString()} ONLINE</span>
            <span className="text-muted">{products.length} VAULT PIECES</span>
            {cartItems.length > 0 && <span className="hidden sm:inline text-ink font-bold">{cartItems.length} in cart</span>}
          </div>
        </div>
      </div>

      {/* LIVE announcement banner — full-width gold strip, impossible to miss when vault is live */}
      <AnimatePresence>
        {isLive && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden bg-gold text-ink">
            <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-3 flex items-center justify-center gap-3">
              <motion.span animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-ink shrink-0" />
              <span className="font-mono text-[11px] sm:text-[13px] tracking-[0.16em] font-bold text-center">VAULT IS LIVE NOW — 60 MINUTES ONLY</span>
              <motion.span animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.7 }} className="w-2.5 h-2.5 rounded-full bg-ink shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vault went LIVE while page open — big celebration overlay */}
      <AnimatePresence>
        {justWentLive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setJustWentLive(false)}>
            <motion.div
              initial={{ scale: 0.85, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 260 }}
              className="bg-ink text-white rounded-[22px] border border-white/10 px-8 sm:px-12 py-10 text-center shadow-2xl max-w-[92vw]"
            >
              <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.8, repeat: 2 }} className="text-[44px] leading-none">🔓</motion.div>
              <div className="mt-4 font-extrabold text-[26px] sm:text-[32px] tracking-[-0.03em]">THE VAULT IS LIVE</div>
              <div className="mt-2 font-mono text-[11px] sm:text-[12px] text-gold tracking-[0.22em]">60 MINUTES • REAL INVENTORY • NO RESTOCK</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12">
        {isLocked ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[720px] mx-auto text-center py-16 sm:py-24">
            <div className="inline-flex items-center gap-2 border border-border rounded-pill px-4 py-2 bg-bg2 shadow-sm"><span className="w-2 h-2 rounded-full bg-ink animate-pulse" /><span className="font-mono text-[11px] tracking-[0.12em]">VAULT IS LOCKED • Server-enforced</span></div>
            <h1 className="mt-8 text-[42px] sm:text-[64px] font-extrabold tracking-[-0.05em] leading-[0.9]">FRIDAY<br /><span className="font-serif italic font-normal">9PM</span> SHARP.</h1>
            <p className="mt-6 text-[16px] leading-[1.6] text-muted max-w-[48ch] mx-auto">Vault unlocks only for 1 hour based on <strong>server time Asia/Dhaka</strong>. Guest can browse, login required for checkout.</p>
            <div className="mt-8 flex justify-center gap-3"><Button className="rounded-pill" onClick={load}>Refresh Status</Button><Button variant="outline" className="rounded-pill" onClick={() => (window.location.href = "/")}>Back to Vault</Button></div>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
              <div>
                <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] sm:text-[44px] font-extrabold tracking-[-0.04em] leading-[0.9]">LIVE NOW — <span className="font-serif italic font-normal">60 MIN</span></motion.h1>
                <p className="mt-3 text-muted text-[14px]">Guest can browse & add to cart. Login required for checkout. Real inventory lock.</p>
                {!user && <p className="mt-2 font-mono text-[11px] text-gold">→ Guest browsing enabled, cart saved locally, login at checkout</p>}
              </div>
              <Badge variant="gold" className="gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-goldDark animate-pulse" />LIVE • {liveTraffic.toLocaleString()} VIEWING</Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">{products.map((p, i) => (<div key={p.id} onClick={() => setSelected(p)} className="cursor-pointer"><ProductCard p={p} index={i} /></div>))}</div>
            {products.length === 0 && <div className="text-center py-16 font-mono text-muted">No live products right now.</div>}
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
              </div>
              <div className="p-6 sm:p-8 flex flex-col">
                <div className="flex-1">
                  <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] leading-[1.15]">{selected.title}</h2>
                  <div className="mt-4 flex items-baseline gap-3"><span className="text-[28px] font-bold tracking-[-0.03em]">{formatBDT(selected.vaultPrice)}</span><span className="text-muted line-through">{formatBDT(selected.originalPrice)}</span></div>
                  {selected.description && <p className="mt-4 text-[13px] leading-[1.6] text-muted">{selected.description}</p>}
                  <div className="mt-6 space-y-3 text-[13px] leading-[1.6] text-ink2">
                    <div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Available</span><span className="font-mono font-bold">{selected.availableQuantity} pcs</span></div>
                    <div className="flex justify-between border-b border-border py-2.5"><span className="text-muted">Category</span><span className="font-medium">{selected.category}</span></div>
                  </div>
                </div>
                <div className="mt-8 space-y-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-[12px] font-mono">QTY</span>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full border grid place-items-center">-</button>
                    <span className="font-bold w-6 text-center">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min(selected.availableQuantity, quantity + 1))} className="w-8 h-8 rounded-full border grid place-items-center">+</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-pill h-[48px]" onClick={() => { handleAddToCart(selected); setSelected(null); }}>Add to Cart</Button>
                    <Button className="rounded-pill h-[48px]" onClick={handleBuyClick} disabled={!isLive || selected.availableQuantity === 0}>{selected.availableQuantity === 0 ? "Sold Out" : user ? `Buy — ${formatBDT(selected.vaultPrice * quantity)}` : "Sign in to Buy →"}</Button>
                  </div>
                  <p className="text-center font-mono text-[10px] text-muted">Guest can add to cart • Login required at checkout • Cart restored after login</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <CheckoutModal
        open={showCheckout && !!selected}
        onClose={() => setShowCheckout(false)}
        product={selected}
        quantity={quantity}
        onSuccess={() => {
          setTimeout(() => {
            setShowCheckout(false);
            setSelected(null);
            setQuantity(1);
            load();
          }, 3200);
        }}
      />

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} mode={authMode} onSuccess={() => setShowCheckout(true)} />
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
