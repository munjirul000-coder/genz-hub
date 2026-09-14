"use client";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Header } from "@/components/header";
import { Countdown } from "@/components/countdown";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollProgress } from "@/components/scroll-progress";
import { MagneticButton } from "@/components/magnetic-button";
import { Marquee } from "@/components/marquee";
import { CountUp } from "@/components/count-up";
import { useEffect, useState, useRef } from "react";
import type { Product } from "@/lib/db";

const brands = ["Aarong", "Yellow", "Sailor", "Ecstasy", "Cats Eye", "Richman", "Aarong", "Yellow"];

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <ScrollProgress />
      <Header />

      {/* Background orbs — optimized: reduced blur, no repeat heavy */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-gold/10 via-bg3 to-transparent blur-[40px] opacity-60" />
        <div className="absolute top-[40%] -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-ink/[0.04] via-bg4 to-transparent blur-[40px] opacity-40" />
      </div>

      {/* HERO — Editorial Vault with parallax */}
      <section ref={heroRef} className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] pt-10 sm:pt-16 pb-8 relative">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-start">
          <motion.div style={{ opacity }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.6 }}>
              <Badge variant="gold" className="mb-5 gap-2 px-3 py-1.5 text-[11px] backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-goldDark animate-pulse" />
                EVERY FRIDAY • 9PM • 1 HOUR ONLY
              </Badge>
            </motion.div>

            {/* Text reveal staggered */}
            <h1 className="font-extrabold tracking-[-0.05em] leading-[0.9] text-[44px] sm:text-[64px] lg:text-[88px] overflow-hidden">
              {["SURPLUS", "Stocks.", "TOP", "BRANDS."].map((word, i) => (
                <motion.div
                  key={word}
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className={i === 1 ? "font-serif font-normal italic tracking-[-0.03em] text-[0.92em]" : ""}
                >
                  {word}
                  {i === 0 && <br />}
                  {i === 1 && <br />}
                  {i === 2 && <br />}
                </motion.div>
              ))}
            </h1>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="mt-6 flex items-center gap-4"
            >
              <motion.div initial={{ width: 0 }} animate={{ width: 48 }} transition={{ delay: 0.9, duration: 0.8 }} className="h-[1px] bg-ink" />
              <p className="font-mono text-[12px] tracking-[0.14em] text-muted uppercase">80% OFF • Deadstock • VIP Access</p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-8 max-w-[48ch] text-[16px] sm:text-[18px] leading-[1.6] text-ink2"
            >
              Bangladesh&apos;s most wanted 1-hour drop. We unlock surplus from top factories —
              <span className="font-serif italic"> once it&apos;s gone, it&apos;s vaulted forever.</span>
            </motion.p>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.6 }} className="mt-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-2 rounded-full bg-ink animate-pulse" />
                <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted">Next Drop Unlocks In</span>
              </div>
              <Countdown />
              <div className="mt-8 flex gap-3">
                <MagneticButton>
                  <Link href="/drop">
                    <Button size="lg" className="rounded-pill px-8 h-[54px] text-[14px] group relative overflow-hidden">
                      <span className="relative z-10 flex items-center gap-2">
                        Enter Live Vault
                        <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          →
                        </motion.span>
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-ink via-ink2 to-ink"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "0%" }}
                        transition={{ duration: 0.4 }}
                      />
                    </Button>
                  </Link>
                </MagneticButton>
                <Link href="/merchant">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" size="lg" className="rounded-pill h-[54px] backdrop-blur-sm">
                      Sell Your Stock
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>

            {/* Social proof with count-up */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-8 max-w-[420px]"
            >
              {[
                { k: 14200, suffix: "", l: "LIVE NOW", plus: true },
                { k: 80, suffix: "%", l: "AVG DISCOUNT" },
                { k: 2300, suffix: "", l: "SOLD / DROP" },
              ].map((s, i) => (
                <motion.div key={s.l} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className="font-bold text-[22px] tracking-[-0.03em] flex items-baseline">
                    <CountUp value={s.k} suffix={s.suffix} />
                    {s.plus && <span className="text-gold">+</span>}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.12em] text-muted mt-1">{s.l}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right visual — parallax vault stack */}
          <motion.div style={{ y }} className="relative lg:sticky lg:top-[104px]">
            <motion.div
              initial={{ opacity: 0, y: 60, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-bg2 border border-border rounded-xl sm:rounded-[22px] shadow-lg overflow-hidden p-3 sm:p-4"
              style={{ transformPerspective: 1000 }}
            >
              <div className="grid grid-cols-2 gap-3">
                {products.slice(0, 4).map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden bg-bg3 group cursor-pointer"
                  >
                    <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 right-2 bg-bg2/90 backdrop-blur-md border border-border rounded-md px-2.5 py-2 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="text-[11px] font-bold tracking-[-0.01em] truncate">{p.brand}</div>
                      <div className="text-[10px] font-mono text-muted">৳{p.vaultPrice}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between px-1">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((n) => (
                    <motion.div
                      key={n}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1 + n * 0.1, type: "spring" }}
                      className="w-7 h-7 rounded-full bg-bg3 border-2 border-bg2 grid place-items-center text-[10px] font-bold shadow-sm"
                    >
                      {n}
                    </motion.div>
                  ))}
                </div>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="font-mono text-[11px] text-muted flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  +1,423 viewing now
                </motion.span>
              </div>
            </motion.div>

            {/* Floating badges with advanced motion */}
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 1, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="absolute -top-4 -right-2 sm:-right-6 bg-ink text-bg rounded-pill px-4 py-2 shadow-md text-[11px] font-bold tracking-wide cursor-pointer"
            >
              🔒 VAULT LOCKED
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0], rotate: [0, -1, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
              className="absolute -bottom-6 -left-4 sm:-left-8 bg-bg2 border border-border rounded-lg px-3 py-2.5 shadow-md backdrop-blur-md"
            >
              <div className="font-mono text-[10px] text-muted">LIVE TRAFFIC</div>
              <div className="font-bold text-[16px] tracking-[-0.02em] flex items-center gap-2">
                <CountUp value={14230} /> online
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* BRANDS marquee */}
      <Marquee items={brands} />

      {/* Vault preview with stagger */}
      <section className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-end justify-between gap-6 mb-10"
        >
          <div>
            <h2 className="text-[32px] sm:text-[44px] font-extrabold tracking-[-0.04em] leading-[0.95] overflow-hidden">
              <motion.span initial={{ y: "100%" }} whileInView={{ y: "0%" }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="block">
                THIS WEEK&apos;S
              </motion.span>
              <motion.span
                initial={{ y: "100%" }}
                whileInView={{ y: "0%" }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="block font-serif font-normal italic"
              >
                Vault Drops
              </motion.span>
            </h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="mt-4 text-muted max-w-[42ch] text-[15px] leading-[1.6]">
              Curated deadstock, export leftovers, sample sets — authenticated, photographed, vaulted.
            </motion.p>
          </div>
          <motion.div whileHover={{ x: 4 }}>
            <Link href="/drop" className="font-mono text-[12px] tracking-[0.1em] underline underline-offset-4 hover:text-ink flex items-center gap-2 group">
              VIEW LIVE DROP
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="group-hover:translate-x-1 transition-transform">
                →
              </motion.span>
            </Link>
          </motion.div>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* How it works — editorial with scroll reveal */}
      <section className="bg-ink text-bg rounded-t-[28px] sm:rounded-t-[36px] mt-8 relative overflow-hidden">
        {/* Grain */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')] pointer-events-none" />
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-16 sm:py-24 relative">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <div className="lg:sticky lg:top-10">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <Badge variant="secondary" className="bg-white/10 text-white/70 border-white/10 mb-6 backdrop-blur-md">
                  HOW IT WORKS
                </Badge>
                <h2 className="text-[36px] sm:text-[52px] font-extrabold tracking-[-0.04em] leading-[0.9]">
                  {["NOT A", "Marketplace.", "A VAULT."].map((line, i) => (
                    <motion.div
                      key={line}
                      initial={{ y: "100%", opacity: 0 }}
                      whileInView={{ y: "0%", opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className={i === 1 ? "font-serif font-normal italic text-white/80 overflow-hidden" : "overflow-hidden"}
                    >
                      {line}
                    </motion.div>
                  ))}
                </h2>
              </motion.div>
            </div>
            <div className="grid gap-6">
              {[
                { n: "01", t: "Merchants submit surplus", d: "Factories, brands, wholesalers submit deadstock with real photos, stock count, and cost. We verify authenticity." },
                { n: "02", t: "We curate & price to move", d: "Admin approves only 12-18 pieces per drop. We set vault price (70-85% off) to guarantee sell-through in 1 hour." },
                { n: "03", t: "Friday 9PM — Vault unlocks", d: "Live traffic 10k+ , FOMO timer, stock counter, bKash checkout. Unsold returns to vault. No restock." },
              ].map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 30, rotateX: 10 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <Card className="bg-white/[0.06] border-white/10 backdrop-blur-md rounded-lg hover:bg-white/[0.08] hover:border-white/15 transition-all duration-500 group">
                    <CardContent className="p-6 sm:p-8 flex gap-6">
                      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }} className="font-mono text-[13px] text-white/40 pt-1 group-hover:text-white/60 transition-colors">
                        {s.n}
                      </motion.div>
                      <div>
                        <div className="font-bold text-[18px] tracking-[-0.02em] group-hover:tracking-[-0.01em] transition-all">{s.t}</div>
                        <div className="mt-2 text-[14px] leading-[1.6] text-white/60 group-hover:text-white/70 transition-colors">{s.d}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-ink text-white/50 border-t border-white/10">
        <div className="max-w-[1320px] mx-auto px-[28px] h-[72px] flex items-center justify-between text-[12px] font-mono">
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            © 2026 FlashVault BD • Surplus, not waste.
          </motion.span>
          <div className="flex gap-6">
            <Link href="/merchant" className="hover:text-white transition-colors hover:tracking-wide">
              Merchants
            </Link>
            <Link href="/admin" className="hover:text-white transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
