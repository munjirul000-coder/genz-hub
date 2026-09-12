"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import type { Product } from "@/lib/db";

export function ProductCard({ p, index }: { p: Product; index: number }) {
  const pct = Math.round(((p.originalPrice - p.vaultPrice) / p.originalPrice) * 100);
  const soldPct = Math.round((p.sold / (p.stock + p.sold)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group relative bg-bg2 border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-500"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-bg3">
        <img
          src={p.image}
          alt={p.title}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60" />
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant="gold" className="shadow-sm">-{pct}%</Badge>
          <Badge variant="secondary" className="shadow-sm font-mono">{p.brand}</Badge>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="live" className="shadow-sm gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseDot" />
            {p.stock} LEFT
          </Badge>
        </div>
        {/* Sold bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/10">
          <div className="h-full bg-ink transition-all" style={{ width: `${soldPct}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-[14px] sm:text-[15px] leading-[1.25] tracking-[-0.015em] line-clamp-2">{p.title}</h3>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-bold text-[18px] tracking-[-0.02em]">{formatBDT(p.vaultPrice)}</span>
          <span className="text-[12px] text-muted line-through">{formatBDT(p.originalPrice)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] font-mono text-muted tracking-wide">{p.sold} SOLD • {p.category}</span>
          <span className="text-[11px] font-bold tracking-wide text-ink group-hover:translate-x-0.5 transition-transform">VAULT →</span>
        </div>
      </div>
    </motion.div>
  );
}
