"use client";
import { motion } from "framer-motion";

export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="relative overflow-hidden border-y border-border bg-bg2/60 backdrop-blur-sm">
      <div className="flex">
        <motion.div
          className="flex gap-12 py-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {[...items, ...items, ...items].map((b, i) => (
            <span key={i} className="flex items-center gap-12">
              <span className="font-bold tracking-[-0.02em] text-[15px] text-ink/70 whitespace-nowrap">{b}</span>
              <span className="w-1 h-1 rounded-full bg-border2" />
            </span>
          ))}
        </motion.div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg2 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg2 to-transparent" />
    </div>
  );
}
