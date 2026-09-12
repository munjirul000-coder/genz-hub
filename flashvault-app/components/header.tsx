"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/", label: "Vault" },
  { href: "/drop", label: "Live Drop" },
  { href: "/merchant", label: "Merchants" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-[24px] backdrop-saturate-[180%] bg-[rgba(253,252,250,0.82)] border-b border-border">
      <div className="max-w-[1320px] mx-auto h-[72px] flex items-center justify-between px-[28px] gap-5">
        <Link href="/" className="flex items-center gap-3 font-extrabold tracking-[-0.04em] text-[20px]">
          <div className="w-[38px] h-[38px] rounded-[11px] bg-ink text-bg grid place-items-center shadow-sm relative overflow-hidden">
            <span className="relative z-10 font-mono text-[14px] font-bold">FV</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
            />
          </div>
          <span className="tracking-[-0.03em]">
            FLASH<span className="font-serif font-normal text-muted italic">Vault</span>
          </span>
          <Badge variant="live" className="ml-1 hidden sm:flex gap-1.5">
            <span className="w-[6px] h-[6px] rounded-full bg-[#22c55e] animate-pulseDot" />
            BD
          </Badge>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-4 h-[36px] grid place-items-center rounded-pill text-[13px] font-medium tracking-[-0.01em] transition-all",
                  active ? "bg-ink text-bg shadow-sm" : "text-muted hover:text-ink hover:bg-bg3"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden lg:flex font-mono text-[10px] gap-1.5 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            NEXT: FRI 9PM
          </Badge>
          <Link href="/drop">
            <Button size="sm" className="rounded-pill">Enter Vault →</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
