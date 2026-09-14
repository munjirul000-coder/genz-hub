"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatBDT } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { AuthModal } from "@/components/auth-modal";
import Link from "next/link";
import type { Product } from "@/lib/types";

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [drop, setDrop] = useState<any>(null);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [realInventory, setRealInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const { user } = useAuth();
  const { add: addToCart } = useCart();

  useEffect(() => {
    const saved = localStorage.getItem("fv_wishlist");
    if (saved) setWishlist(JSON.parse(saved));
  }, []);

  const toggleWishlist = (productId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    let updated: string[];
    if (wishlist.includes(productId)) {
      updated = wishlist.filter(id => id !== productId);
    } else {
      updated = [...wishlist, productId];
    }
    setWishlist(updated);
    localStorage.setItem("fv_wishlist", JSON.stringify(updated));
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/products/${id}`, { cache: "no-store" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Product not found");
      }
      const d = await r.json();
      setProduct(d.product);
      setMerchant(d.merchant);
      setDrop(d.drop);
      setIsSoldOut(d.isSoldOut);
      setRealInventory(d.realInventory);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const isLocked = !drop?.isLive;
  const canBuy = drop?.isLive && !isSoldOut && (product?.availableQuantity || 0) > 0;

  const handleAddToCart = () => {
    if (!product) return;
    if (isLocked) return;
    if (isSoldOut) return;
    addToCart({
      id: product.id,
      title: product.title,
      brand: product.brand,
      vaultPrice: product.vaultPrice,
      originalPrice: product.originalPrice,
      image: product.image,
    }, quantity);
    // Show feedback
    const btn = document.getElementById("add-to-cart-btn");
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Added!";
      setTimeout(() => { if (btn) btn.textContent = orig; }, 1500);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (isLocked) return;
    if (isSoldOut) return;

    setCheckoutError("");
    setCheckoutLoading(true);
    const idempotencyKey = `order_${product.id}_${user.id}_${Date.now()}`;
    try {
      const r = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          customerPhone: user.phone || "01700000000",
          customerName: user.name,
          address: "Dhanmondi, Dhaka",
          city: "Dhaka",
          idempotencyKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.code === "AUTH_REQUIRED") {
          setShowAuthModal(true);
        }
        throw new Error(d.error || "Order failed");
      }
      setOrdered(true);
      setTimeout(() => {
        router.push("/account");
      }, 2000);
    } catch (e: any) {
      setCheckoutError(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-12">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10">
            <div className="aspect-[4/5] bg-bg3 rounded-[20px] animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-bg3 rounded animate-pulse" />
              <div className="h-4 bg-bg3 rounded animate-pulse w-2/3" />
              <div className="h-20 bg-bg3 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 grid place-items-center mx-auto text-[24px]">!</div>
          <h1 className="mt-6 text-[28px] font-extrabold tracking-tight">{error || "Product not found"}</h1>
          <p className="mt-3 text-muted">The vault piece you are looking for does not exist or was removed.</p>
          <Link href="/"><Button className="mt-6 rounded-pill">Back to Vault →</Button></Link>
        </div>
      </div>
    );
  }

  const discount = Math.round(((product.originalPrice - product.vaultPrice) / product.originalPrice) * 100);
  const images = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <div className="min-h-screen bg-bg">
      <Header />

      {/* Breadcrumb */}
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-4">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          <Link href="/" className="hover:text-ink">Vault</Link>
          <span>→</span>
          <Link href="/drop" className="hover:text-ink">Drops</Link>
          <span>→</span>
          <span className="text-ink font-medium truncate">{product.title}</span>
        </div>
      </div>

      {/* Vault State Banner */}
      <div className={`border-y ${isLocked ? "bg-ink text-white border-ink" : "bg-emerald-50 border-emerald-200 text-emerald-900"} `}>
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] h-[44px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${isLocked ? "bg-white animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
            <span className="font-mono text-[11px] tracking-[0.12em] font-bold">{isLocked ? "VAULT LOCKED • VIEW ONLY" : "VAULT LIVE • REAL INVENTORY"}</span>
            {drop && <Badge variant={isLocked ? "secondary" : "gold"} className={`${isLocked ? "bg-white/10 text-white border-white/20" : ""} text-[10px]`}>{drop.state}</Badge>}
          </div>
          <div className="font-mono text-[11px] flex items-center gap-3">
            {isLocked && drop?.nextDropAt && <span className="hidden sm:inline">Unlocks: {new Date(drop.nextDropAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</span>}
            {canBuy && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{realInventory?.available} left • Real-time</span>}
            {isSoldOut && <span className="font-bold text-red-600">SOLD OUT</span>}
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-start">
          {/* Left - Gallery */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="relative bg-bg2 border border-border rounded-[20px] sm:rounded-[28px] overflow-hidden shadow-sm">
              <div className="relative aspect-[4/5] bg-bg3 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={selectedImage}
                    src={images[selectedImage]}
                    alt={product.title}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full object-cover"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge variant="gold" className="shadow-md backdrop-blur-md">-{discount}% OFF</Badge>
                  <Badge variant="secondary" className="shadow-md backdrop-blur-md font-mono">{product.brand}</Badge>
                  {product.verificationStatus === "verified" && <Badge variant="live" className="shadow-md backdrop-blur-md gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />VERIFIED</Badge>}
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                    className={`w-10 h-10 rounded-full backdrop-blur-md border shadow-sm grid place-items-center transition ${wishlist.includes(product.id) ? "bg-red-500 border-red-500 text-white" : "bg-white/90 border-border hover:bg-white"}`}
                  >
                    {wishlist.includes(product.id) ? "♥" : "♡"}
                  </button>
                </div>
                {isLocked && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] grid place-items-center">
                    <div className="bg-ink text-white rounded-pill px-6 py-3 font-bold text-[13px] tracking-wide shadow-lg flex items-center gap-2">
                      🔒 VAULT LOCKED • {drop?.nextDropAt ? `Unlocks ${new Date(drop.nextDropAt).toLocaleDateString("en-BD", { timeZone: "Asia/Dhaka" })}` : "View Only"}
                    </div>
                  </div>
                )}
                {isSoldOut && !isLocked && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] grid place-items-center">
                    <div className="bg-white text-ink rounded-pill px-6 py-3 font-bold text-[13px] shadow-lg">SOLD OUT • Real inventory 0</div>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="p-3 flex gap-2 overflow-x-auto">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`relative w-20 h-24 rounded-lg overflow-hidden border-2 flex-shrink-0 transition ${selectedImage === i ? "border-ink" : "border-border hover:border-border2"}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trust badges */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Authentic", sub: "Verified surplus" },
                { label: "Real Discount", sub: `${discount}% server-calc` },
                { label: "Real Stock", sub: `${realInventory?.available} left` },
              ].map(b => (
                <Card key={b.label} className="rounded-lg bg-bg2 border-border">
                  <CardContent className="p-3 text-center">
                    <div className="font-bold text-[12px] tracking-tight">{b.label}</div>
                    <div className="font-mono text-[10px] text-muted mt-1">{b.sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Right - Details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }} className="lg:sticky lg:top-[96px]">
            <div>
              <Badge variant="gold" className="mb-3">{product.category} • {product.condition}</Badge>
              <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-0.04em] leading-[1.05]">{product.title}</h1>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-mono text-[12px] text-muted">By</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-ink text-white grid place-items-center text-[11px] font-bold">{merchant?.brand?.[0] || product.brand[0]}</div>
                  <span className="font-bold text-[13px]">{merchant?.brand || product.brand}</span>
                  {merchant?.verified && <span className="w-4 h-4 rounded-full bg-emerald-500 text-white grid place-items-center text-[10px]">✓</span>}
                </div>
                {merchant && <Badge variant="secondary" className="text-[10px]">{merchant.status}</Badge>}
              </div>

              <div className="mt-6 flex items-baseline gap-4">
                <span className="text-[32px] font-extrabold tracking-[-0.03em]">{formatBDT(product.vaultPrice)}</span>
                <span className="text-[16px] text-muted line-through">{formatBDT(product.originalPrice)}</span>
                <Badge variant="gold" className="text-[12px] px-3 py-1">-{discount}% • Real</Badge>
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted">Discount calculated server-side: (original - vault) / original * 100 • No fake pricing</div>

              {product.description && (
                <div className="mt-8">
                  <h3 className="font-bold text-[13px] tracking-wide uppercase font-mono text-muted mb-3">Description</h3>
                  <p className="text-[14px] leading-[1.7] text-ink2">{product.description}</p>
                </div>
              )}

              <div className="mt-8 grid gap-0 border border-border rounded-lg overflow-hidden bg-bg2">
                {[
                  { label: "Available Quantity", value: `${realInventory?.available ?? product.availableQuantity} pcs • Real-time • ${realInventory?.sold ?? product.soldQuantity} sold`, mono: true },
                  { label: "Total Stock", value: `${product.stock} pcs (original)`, mono: true },
                  { label: "Sizes / Variants", value: product.size || "One size • Contact merchant for variants" },
                  { label: "Condition", value: product.condition },
                  { label: "Location", value: product.location || "Dhaka, Bangladesh" },
                  { label: "Delivery", value: product.deliveryInfo || "Pathao 24h inside Dhaka, 48h outside" },
                  { label: "Return Policy", value: product.returnPolicy || "No return - vault sale, 1 hour only" },
                  { label: "Verification", value: product.verificationStatus === "verified" ? "✓ Verified by admin" : product.verificationStatus === "suspicious" ? "⚠️ Flagged for verification" : "Unverified - pending check", highlight: product.verificationStatus === "verified" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between gap-4 px-4 py-3 border-b border-border last:border-0 text-[13px]">
                    <span className="text-muted font-mono text-[11px] tracking-wide uppercase pt-0.5">{row.label}</span>
                    <span className={`font-medium text-right max-w-[60%] ${row.mono ? "font-mono" : ""} ${row.highlight ? "text-emerald-600 font-bold" : ""}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {isLocked && (
                <div className="mt-6 p-4 rounded-xl bg-ink text-white">
                  <div className="flex items-center gap-2 font-bold text-[13px]"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />VAULT LOCKED</div>
                  <p className="mt-2 text-[13px] leading-[1.6] text-white/70">You can view details, but Buy Now and Add to Cart are disabled until vault unlocks. Next unlock: <strong className="text-white">{drop?.nextDropAt ? new Date(drop.nextDropAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka", weekday: "long", hour: "2-digit", minute: "2-digit" }) : "Friday 9PM Asia/Dhaka"}</strong></p>
                  <div className="mt-3 font-mono text-[11px] text-white/50">Server time: {drop?.serverTime ? new Date(drop.serverTime).toLocaleString() : new Date().toLocaleString()} • Timezone: {drop?.timezone}</div>
                </div>
              )}

              {isSoldOut && !isLocked && (
                <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
                  <div className="font-bold text-[13px]">Sold Out • Real inventory 0</div>
                  <p className="mt-1 text-[12px]">This vault piece is vaulted forever. No restock.</p>
                </div>
              )}

              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted">QTY</span>
                  <div className="flex items-center gap-2 border border-border rounded-pill px-1 h-10 bg-bg2">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full hover:bg-bg3 grid place-items-center">-</button>
                    <span className="font-bold w-8 text-center text-[14px]">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min(realInventory?.available || 10, quantity + 1))} className="w-8 h-8 rounded-full hover:bg-bg3 grid place-items-center">+</button>
                  </div>
                  <span className="font-mono text-[11px] text-muted">Max {Math.min(5, realInventory?.available || 1)} per order • Real stock</span>
                </div>

                <div className="grid grid-cols-[1fr_1.2fr] gap-3">
                  <Button
                    id="add-to-cart-btn"
                    variant="outline"
                    size="lg"
                    className="rounded-pill h-[52px] font-bold"
                    onClick={handleAddToCart}
                    disabled={isLocked || isSoldOut}
                  >
                    {isLocked ? "🔒 Locked" : isSoldOut ? "Sold Out" : "Add to Cart"}
                  </Button>
                  <Button
                    size="lg"
                    className="rounded-pill h-[52px] font-bold"
                    onClick={handleBuyNow}
                    disabled={isLocked || isSoldOut || checkoutLoading}
                  >
                    {checkoutLoading ? "..." : isLocked ? "Vault Locked" : isSoldOut ? "Sold Out" : `Buy Now — ${formatBDT(product.vaultPrice * quantity)}`}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="rounded-pill h-[44px] gap-2"
                    onClick={() => toggleWishlist(product.id)}
                    disabled={false}
                  >
                    <span>{wishlist.includes(product.id) ? "♥" : "♡"}</span> {wishlist.includes(product.id) ? "Wishlisted" : "Wishlist"} {wishlist.includes(product.id) ? `(${wishlist.length})` : ""}
                  </Button>
                  <Button variant="ghost" className="rounded-pill h-[44px]" onClick={() => { if (navigator.share) navigator.share({ title: product.title, url: window.location.href }); else navigator.clipboard.writeText(window.location.href); }}>
                    Share →
                  </Button>
                </div>

                {checkoutError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">{checkoutError}</div>}
                {ordered && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold">✓ Order locked! Redirecting to account...</div>}

                <div className="pt-2 text-center font-mono text-[10px] text-muted leading-[1.5]">
                  {isLocked ? "View only • Login not required to view • Login required to buy" : "Real inventory • No overselling • Idempotency protected • Server-enforced vault • Guest can view, login required to buy"}
                </div>
              </div>

              <div className="mt-8 flex gap-2">
                <Link href="/drop" className="flex-1"><Button variant="outline" className="w-full rounded-pill">Back to Live Drop →</Button></Link>
                <Link href="/" className="flex-1"><Button variant="ghost" className="w-full rounded-pill">Back to Vault</Button></Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} mode="login" onSuccess={() => { setShowAuthModal(false); }} />
    </div>
  );
}
