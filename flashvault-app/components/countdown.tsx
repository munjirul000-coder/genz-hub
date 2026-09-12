"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getNextFriday9PM } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Countdown({ target }: { target?: Date }) {
  const [diff, setDiff] = useState<number>(0);

  useEffect(() => {
    const t = target ?? getNextFriday9PM();
    const calc = () => setDiff(Math.max(0, t.getTime() - Date.now()));
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [target]);

  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const blocks = [
    { v: d, l: "DAYS" },
    { v: h, l: "HRS" },
    { v: m, l: "MIN" },
    { v: s, l: "SEC" },
  ];

  return (
    <div className="flex gap-2 sm:gap-3">
      {blocks.map((b, i) => (
        <motion.div
          key={b.l}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-ink text-bg rounded-md sm:rounded-lg px-3 sm:px-5 py-3 sm:py-4 min-w-[64px] sm:min-w-[84px] text-center shadow-lg"
        >
          <div className="font-mono font-bold text-[22px] sm:text-[30px] tracking-[-0.04em] leading-none">{pad(b.v)}</div>
          <div className="mt-1.5 text-[9px] font-mono tracking-[0.12em] text-white/60">{b.l}</div>
        </motion.div>
      ))}
    </div>
  );
}
