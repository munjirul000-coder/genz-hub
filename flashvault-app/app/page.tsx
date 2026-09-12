"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Countdown } from "@/components/countdown";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { readDB } from "@/lib/db";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/db";

const brands = ["Aarong", "Yellow", "Sailor", "Ecstasy", "Cats Eye", "Richman"];

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  return (
    <div className="min-h-screen">
      <Header />

      {/* HERO — Editorial Vault */}
      <section className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] pt-10 sm:pt-16 pb-8">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <Badge variant="gold" className="mb-5 gap-2 px-3 py-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-goldDark animate-pulse" />
              EVERY FRIDAY • 9PM • 1 HOUR ONLY
            </Badge>
            <h1 className="font-extrabold tracking-[-0.05em] leading-[0.9] text-[44px] sm:text-[64px] lg:text-[88px]">
              SURPLUS
              <br />
              <span className="font-serif font-normal italic tracking-[-0.03em] text-[0.92em]">Stocks.</span>
              <br />
              TOP
              <br />
              BRANDS.
            </h1>
            <div className="mt-6 flex items-center gap-4">
              <div className="h-[1px] w-12 bg-ink" />
              <p className="font-mono text-[12px] tracking-[0.14em] text-muted uppercase">80% OFF • Deadstock • VIP Access</p>
            </div>
            <p className="mt-8 max-w-[48ch] text-[16px] sm:text-[18px] leading-[1.6] text-ink2">
              Bangladesh&apos;s most wanted 1-hour drop. We unlock surplus from top factories —
              <span className="font-serif italic"> once it&apos;s gone, it&apos;s vaulted forever.</span>
            </p>

            <div className="mt-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-2 rounded-full bg-ink animate-pulse" />
                <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted">Next Drop Unlocks In</span>
              </div>
              <Countdown />
              <div className="mt-8 flex gap-3">
                <Link href="/drop">
                  <Button size="lg" className="rounded-pill px-8 h-[54px] text-[14px]">
                    Enter Live Vault →
                  </Button>
                </Link>
                <Link href="/merchant">
                  <Button variant="outline" size="lg" className="rounded-pill h-[54px]">
                    Sell Your Stock
                  </Button>
                </Link>
              </div>
            </div>

            {/* Social proof */}
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-8 max-w-[420px]">
              {[
                { k: "14.2k", l: "LIVE NOW" },
                { k: "80%", l: "AVG DISCOUNT" },
                { k: "2.3k", l: "SOLD / DROP" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-bold text-[22px] tracking-[-0.03em]">{s.k}</div>
                  <div className="font-mono text-[10px] tracking-[0.12em] text-muted mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right visual — vault stack */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative lg:sticky lg:top-[104px]"
          >
            <div className="relative bg-bg2 border border-border rounded-xl sm:rounded-[22px] shadow-lg overflow-hidden p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-3">
                {products.slice(0, 4).map((p, i) => (
                  <div key={p.id} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-bg3">
                    <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 right-2 bg-bg2/90 backdrop-blur-md border border-border rounded-md px-2.5 py-2">
                      <div className="text-[11px] font-bold tracking-[-0.01em] truncate">{p.brand}</div>
                      <div className="text-[10px] font-mono text-muted">৳{p.vaultPrice}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between px-1">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="w-7 h-7 rounded-full bg-bg3 border-2 border-bg2 grid place-items-center text-[10px] font-bold">
                      {n}
                    </div>
                  ))}
                </div>
                <span className="font-mono text-[11px] text-muted">+1,423 viewing now</span>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-4 -right-2 sm:-right-6 bg-ink text-bg rounded-pill px-4 py-2 shadow-md text-[11px] font-bold tracking-wide"
            >
              🔒 VAULT LOCKED
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -bottom-6 -left-4 sm:-left-8 bg-bg2 border border-border rounded-lg px-3 py-2.5 shadow-md"
            >
              <div className="font-mono text-[10px] text-muted">LIVE TRAFFIC</div>
              <div className="font-bold text-[16px] tracking-[-0.02em]">14,230 online</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* BRANDS ticker */}
      <section className="border-y border-border bg-bg2/60 backdrop-blur-sm">
        <div className="max-w-[1320px] mx-auto px-[28px] h-[64px] flex items-center gap-8 overflow-x-auto">
          <span className="font-mono text-[10px] tracking-[0.18em] text-muted2 whitespace-nowrap">TRUSTED SURPLUS FROM</span>
          <div className="flex items-center gap-8">
            {brands.map((b) => (
              <span key={b} className="font-bold tracking-[-0.02em] text-[15px] text-ink/70 whitespace-nowrap">
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Vault preview */}
      <section className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-[32px] sm:text-[44px] font-extrabold tracking-[-0.04em] leading-[0.95]">
              THIS WEEK&apos;S <br />
              <span className="font-serif font-normal italic">Vault Drops</span>
            </h2>
            <p className="mt-4 text-muted max-w-[42ch] text-[15px] leading-[1.6]">
              Curated deadstock, export leftovers, sample sets — authenticated, photographed, vaulted.
            </p>
          </div>
          <Link href="/drop" className="font-mono text-[12px] tracking-[0.1em] underline underline-offset-4 hover:text-ink">
            VIEW LIVE DROP →
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* How it works — editorial */}
      <section className="bg-ink text-bg rounded-t-[28px] sm:rounded-t-[36px] mt-8">
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-16 sm:py-24">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <div className="lg:sticky lg:top-10">
              <Badge variant="secondary" className="bg-white/10 text-white/70 border-white/10 mb-6">
                HOW IT WORKS
              </Badge>
              <h2 className="text-[36px] sm:text-[52px] font-extrabold tracking-[-0.04em] leading-[0.9]">
                NOT A
                <br />
                <span className="font-serif font-normal italic text-white/80">Marketplace.</span>
                <br />A VAULT.
              </h2>
            </div>
            <div className="grid gap-6">
              {[
                {
                  n: "01",
                  t: "Merchants submit surplus",
                  d: "Factories, brands, wholesalers submit deadstock with real photos, stock count, and cost. We verify authenticity.",
                },
                {
                  n: "02",
                  t: "We curate & price to move",
                  d: "Admin approves only 12-18 pieces per drop. We set vault price (70-85% off) to guarantee sell-through in 1 hour.",
                },
                {
                  n: "03",
                  t: "Friday 9PM — Vault unlocks",
                  d: "Live traffic 10k+ , FOMO timer, stock counter, bKash checkout. Unsold returns to vault. No restock.",
                },
              ].map((s) => (
                <Card key={s.n} className="bg-white/[0.06] border-white/10 backdrop-blur-md rounded-lg">
                  <CardContent className="p-6 sm:p-8 flex gap-6">
                    <div className="font-mono text-[13px] text-white/40 pt-1">{s.n}</div>
                    <div>
                      <div className="font-bold text-[18px] tracking-[-0.02em]">{s.t}</div>
                      <div className="mt-2 text-[14px] leading-[1.6] text-white/60">{s.d}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-ink text-white/50 border-t border-white/10">
        <div className="max-w-[1320px] mx-auto px-[28px] h-[72px] flex items-center justify-between text-[12px] font-mono">
          <span>© 2026 FlashVault BD • Surplus, not waste.</span>
          <div className="flex gap-6">
            <Link href="/merchant" className="hover:text-white">
              Merchants
            </Link>
            <Link href="/admin" className="hover:text-white">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
