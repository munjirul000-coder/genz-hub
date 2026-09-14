"use client";
import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth-context";

export function ProductCard({ p, index }: { p: Product; index: number }) {
  const pct = Math.round(((p.originalPrice - p.vaultPrice) / p.originalPrice) * 100);
  const soldPct = Math.round((p.sold / (p.stock + p.sold)) * 100);
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 20 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);
  const [hover, setHover] = useState(false);
  const router = useRouter();
  const { add: addToCart } = useCart();
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("fv_wishlist");
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px);
    y.set(py);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
    setHover(false);
  };

  const handleCardClick = () => {
    // Fully interactive - navigate to dedicated product details page
    router.push(`/product/${p.id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent double navigation
    e.preventDefault();
    addToCart({
      id: p.id,
      title: p.title,
      brand: p.brand,
      vaultPrice: p.vaultPrice,
      originalPrice: p.originalPrice,
      image: p.image,
    }, 1);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      router.push(`/login?next=/product/${p.id}`);
      return;
    }
    try {
      const saved = localStorage.getItem("fv_wishlist");
      const current: string[] = saved ? JSON.parse(saved) : [];
      let updated: string[];
      if (current.includes(p.id)) {
        updated = current.filter(id => id !== p.id);
      } else {
        updated = [...current, p.id];
      }
      localStorage.setItem("fv_wishlist", JSON.stringify(updated));
      setWishlist(updated);
    } catch {}
  };

  const isWishlisted = wishlist.includes(p.id);
  const isSoldOut = p.availableQuantity <= 0 || p.status === "soldout";

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={handleLeave}
      onClick={handleCardClick}
      initial={{ opacity: 0, y: 40, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: index * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000 }}
      className="group relative cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
      aria-label={`View ${p.title} details`}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={{ y: -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative bg-bg2 border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-500"
      >
        {/* Image */}
        <div className="relative aspect-[4/5] overflow-hidden bg-bg3">
          <motion.img
            src={p.image.replace("w=600", "w=400").replace("w=800", "w=400")}
            alt={p.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover will-change-transform"
            animate={{ scale: hover ? 1.06 : 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-70" />
          <motion.div
            className="absolute top-3 left-3 flex gap-2"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
          >
            <Badge variant="gold" className="shadow-sm backdrop-blur-md">-{pct}%</Badge>
            <Badge variant="secondary" className="shadow-sm font-mono backdrop-blur-md">{p.brand}</Badge>
          </motion.div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            <Badge variant="live" className="shadow-sm gap-1.5 backdrop-blur-md">
              <span className={`w-1.5 h-1.5 rounded-full ${isSoldOut ? "bg-red-400" : "bg-emerald-400 animate-pulseDot"}`} />
              {isSoldOut ? "SOLD OUT" : `${p.availableQuantity} LEFT`}
            </Badge>
          </div>

          {/* Quick actions - accessible, prevent double navigation */}
          <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <button
              onClick={handleWishlist}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={`w-8 h-8 rounded-full backdrop-blur-md border shadow-sm grid place-items-center text-[14px] transition ${isWishlisted ? "bg-red-500 border-red-500 text-white" : "bg-white/90 border-border hover:bg-white"}`}
            >
              {isWishlisted ? "♥" : "♡"}
            </button>
            <button
              onClick={handleAddToCart}
              aria-label="Add to cart"
              disabled={isSoldOut}
              className="w-8 h-8 rounded-full bg-ink text-white border border-ink shadow-sm grid place-items-center text-[12px] hover:bg-ink2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              +
            </button>
          </div>

          {/* Sold bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/10">
            <motion.div
              className="h-full bg-ink"
              initial={{ width: 0 }}
              whileInView={{ width: `${soldPct}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + index * 0.05, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          {/* Hover shine */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none"
            initial={{ x: "-150%" }}
            animate={{ x: hover ? "150%" : "-150%" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        </div>

        {/* Content */}
        <div className="p-4 sm:p-[18px] relative">
          <h3 className="font-bold text-[14px] sm:text-[15px] leading-[1.25] tracking-[-0.015em] line-clamp-2 group-hover:tracking-[-0.01em] transition-all duration-300">
            {p.title}
          </h3>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-bold text-[18px] tracking-[-0.02em]">{formatBDT(p.vaultPrice)}</span>
            <span className="text-[12px] text-muted line-through">{formatBDT(p.originalPrice)}</span>
            <span className="ml-auto text-[11px] font-mono text-emerald-600 font-bold">{pct}% OFF</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted tracking-wide">{p.soldQuantity} SOLD • {p.category} • {p.condition}</span>
            <motion.span
              className="text-[11px] font-bold tracking-wide text-ink flex items-center gap-1"
              animate={{ x: hover ? 4 : 0 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              VIEW <span className="text-[13px]">→</span>
            </motion.span>
          </div>
          {/* Real inventory indicator */}
          <div className="mt-2 font-mono text-[10px] text-muted flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isSoldOut ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
            {isSoldOut ? "Sold out • Real inventory 0" : `${p.availableQuantity} available • Real-time • ${p.discountPercent}% real discount`}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
