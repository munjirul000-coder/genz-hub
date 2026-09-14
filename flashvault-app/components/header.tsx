"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import { useLang } from "@/lib/i18n";

const navKeys = [
  { href: "/", labelKey: "nav.vault" },
  { href: "/drop", labelKey: "nav.drop" },
  { href: "/merchant", labelKey: "nav.merchant" },
];

export function Header() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLang();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
    const prev = scrollY.getPrevious() ?? 0;
    if (latest > prev && latest > 200) setHidden(true);
    else setHidden(false);
  });

  return (
    <motion.header
      variants={{ visible: { y: 0 }, hidden: { y: "-100%" } }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "sticky top-0 z-50 backdrop-blur-[24px] backdrop-saturate-[180%] border-b transition-all duration-500",
        scrolled ? "bg-[rgba(253,252,250,0.92)] shadow-sm border-border" : "bg-[rgba(253,252,250,0.72)] border-transparent"
      )}
    >
      <div className="max-w-[1320px] mx-auto h-[72px] flex items-center justify-between px-[20px] sm:px-[28px] gap-5">
        <Link href="/" className="flex items-center gap-3 font-extrabold tracking-[-0.04em] text-[20px] group">
          <motion.div
            whileHover={{ rotate: 5, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-[38px] h-[38px] rounded-[11px] bg-ink text-bg grid place-items-center shadow-sm relative overflow-hidden"
          >
            <span className="relative z-10 font-mono text-[14px] font-bold">FV</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
            />
          </motion.div>
          <span className="tracking-[-0.03em] group-hover:tracking-[-0.02em] transition-all duration-300">
            FLASH<span className="font-serif font-normal text-muted italic group-hover:text-ink transition-colors">Vault</span>
          </span>
          <Badge variant="live" className="ml-1 hidden sm:flex gap-1.5 group-hover:scale-105 transition-transform">
            <span className="w-[6px] h-[6px] rounded-full bg-[#22c55e] animate-pulseDot" />
            BD
          </Badge>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navKeys.map((n, i) => {
            const active = pathname === n.href;
            return (
              <motion.div
                key={n.href}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Link
                  href={n.href}
                  className={cn(
                    "px-4 h-[36px] grid place-items-center rounded-pill text-[13px] font-medium tracking-[-0.01em] transition-all relative overflow-hidden",
                    active ? "bg-ink text-bg shadow-sm" : "text-muted hover:text-ink hover:bg-bg3"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-ink rounded-pill"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t(n.labelKey)}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <Badge variant="secondary" className="hidden lg:flex font-mono text-[10px] gap-1.5 px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              {t("badge.next")}
            </Badge>
          </motion.div>
          <Link href="/drop">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button size="sm" className="rounded-pill group">
                <span className="group-hover:mr-1 transition-all">{t("nav.enter").replace(" →", "")}</span>
                <motion.span initial={{ x: 0 }} whileHover={{ x: 3 }} className="inline-block">
                  →
                </motion.span>
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
