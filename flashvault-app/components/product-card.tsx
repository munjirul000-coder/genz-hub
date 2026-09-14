"use client";
import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import type { Product } from "@/lib/types";

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

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={handleLeave}
      initial={{ opacity: 0, y: 40, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: index * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000 }}
      className="group relative"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={{ y: -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative bg-bg2 border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-500"
      >
        {/* Image with parallax - optimized */}
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
          <div className="absolute top-3 right-3">
            <Badge variant="live" className="shadow-sm gap-1.5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseDot" />
              {p.stock} LEFT
            </Badge>
          </div>
          {/* Sold bar with motion */}
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
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
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
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted tracking-wide">{p.sold} SOLD • {p.category}</span>
            <motion.span
              className="text-[11px] font-bold tracking-wide text-ink flex items-center gap-1"
              animate={{ x: hover ? 4 : 0 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              VAULT <span className="text-[13px]">→</span>
            </motion.span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
