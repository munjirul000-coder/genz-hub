"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "en" | "bn";

type Translations = Record<string, Record<Lang, string>>;

export const tData: Translations = {
  // Header
  "nav.vault": { en: "Vault", bn: "ভল্ট" },
  "nav.drop": { en: "Live Drop", bn: "লাইভ ড্রপ" },
  "nav.merchant": { en: "Merchants", bn: "মার্চেন্ট" },
  "nav.enter": { en: "Enter Vault →", bn: "ভল্টে ঢুকুন →" },
  "badge.friday": { en: "EVERY FRIDAY • 9PM • 1 HOUR ONLY", bn: "প্রতি শুক্রবার • রাত ৯টা • মাত্র ১ ঘণ্টা" },
  "badge.next": { en: "NEXT: FRI 9PM", bn: "পরবর্তী: শুক্র ৯টা" },

  // Hero
  "hero.surplus": { en: "SURPLUS", bn: "সারপ্লাস" },
  "hero.stocks": { en: "Stocks.", bn: "স্টক।" },
  "hero.top": { en: "TOP", bn: "টপ" },
  "hero.brands": { en: "BRANDS.", bn: "ব্র্যান্ড।" },
  "hero.sub": { en: "80% OFF • Deadstock • VIP Access", bn: "৮০% ছাড় • ডেডস্টক • ভিআইপি অ্যাক্সেস" },
  "hero.desc": {
    en: "Bangladesh's most wanted 1-hour drop. We unlock surplus from top factories — once it's gone, it's vaulted forever.",
    bn: "বাংলাদেশের সবচেয়ে চাহিদাসম্পন্ন ১ ঘণ্টার ড্রপ। আমরা টপ ফ্যাক্টরির সারপ্লাস আনলক করি — একবার শেষ হলে চিরতরে ভল্টে চলে যায়।",
  },
  "hero.nextDrop": { en: "Next Drop Unlocks In", bn: "পরবর্তী ড্রপ আনলক হবে" },
  "hero.enterVault": { en: "Enter Live Vault →", bn: "লাইভ ভল্টে ঢুকুন →" },
  "hero.sellStock": { en: "Sell Your Stock", bn: "আপনার স্টক বিক্রি করুন" },
  "hero.liveNow": { en: "LIVE NOW", bn: "লাইভ এখন" },
  "hero.avgDiscount": { en: "AVG DISCOUNT", bn: "গড় ছাড়" },
  "hero.soldPerDrop": { en: "SOLD / DROP", bn: "বিক্রি / ড্রপ" },

  // Sections
  "section.trusted": { en: "TRUSTED SURPLUS FROM", bn: "বিশ্বস্ত সারপ্লাস" },
  "section.thisWeeks": { en: "THIS WEEK'S", bn: "এই সপ্তাহের" },
  "section.vaultDrops": { en: "Vault Drops", bn: "ভল্ট ড্রপ" },
  "section.vaultDesc": {
    en: "Curated deadstock, export leftovers, sample sets — authenticated, photographed, vaulted.",
    bn: "বাছাইকৃত ডেডস্টক, এক্সপোর্ট লেফটওভার, স্যাম্পল সেট — যাচাইকৃত, ফটোগ্রাফড, ভল্টেড।",
  },
  "section.viewLive": { en: "VIEW LIVE DROP →", bn: "লাইভ ড্রপ দেখুন →" },
  "section.howItWorks": { en: "HOW IT WORKS", bn: "কিভাবে কাজ করে" },
  "section.notMarketplace": { en: "NOT A", bn: "এটা কোনো" },
  "section.marketplace": { en: "Marketplace.", bn: "মার্কেটপ্লেস নয়।" },
  "section.aVault": { en: "A VAULT.", bn: "এটা একটা ভল্ট।" },

  // How it works
  "how.01.title": { en: "Merchants submit surplus", bn: "মার্চেন্টরা সারপ্লাস জমা দেয়" },
  "how.01.desc": {
    en: "Factories, brands, wholesalers submit deadstock with real photos, stock count, and cost. We verify authenticity.",
    bn: "ফ্যাক্টরি, ব্র্যান্ড, পাইকাররা আসল ছবি, স্টক সংখ্যা ও দাম সহ ডেডস্টক জমা দেয়। আমরা সত্যতা যাচাই করি।",
  },
  "how.02.title": { en: "We curate & price to move", bn: "আমরা বাছাই ও দাম ঠিক করি" },
  "how.02.desc": {
    en: "Admin approves only 12-18 pieces per drop. We set vault price (70-85% off) to guarantee sell-through in 1 hour.",
    bn: "অ্যাডমিন প্রতি ড্রপে মাত্র ১২-১৮ পিস অনুমোদন করে। আমরা ভল্ট প্রাইস (৭০-৮৫% ছাড়) ঠিক করি যাতে ১ ঘণ্টায় সব বিক্রি হয়।",
  },
  "how.03.title": { en: "Friday 9PM — Vault unlocks", bn: "শুক্রবার রাত ৯টা — ভল্ট আনলক" },
  "how.03.desc": {
    en: "Live traffic 10k+, FOMO timer, stock counter, bKash checkout. Unsold returns to vault. No restock.",
    bn: "লাইভ ট্রাফিক ১০হাজার+, FOMO টাইমার, স্টক কাউন্টার, বিকাশ চেকআউট। অবিক্রিত ভল্টে ফিরে যায়। রিস্টক নেই।",
  },

  // Drop
  "drop.live": { en: "LIVE DROP • FRI 9PM", bn: "লাইভ ড্রপ • শুক্র ৯টা" },
  "drop.locked": { en: "LOCKED", bn: "লকড" },
  "drop.unlocked": { en: "UNLOCKED", bn: "আনলকড" },
  "drop.vaultLocked": { en: "VAULT IS LOCKED", bn: "ভল্ট লকড" },
  "drop.fridaySharp": { en: "FRIDAY 9PM SHARP.", bn: "শুক্রবার ঠিক রাত ৯টা।" },
  "drop.testUnlock": { en: "Test Unlock →", bn: "টেস্ট আনলক →" },
  "drop.liveNow": { en: "LIVE NOW — 60 MIN", bn: "লাইভ এখন — ৬০ মিনিট" },

  // Footer
  "footer.copy": { en: "© 2026 FlashVault BD • Surplus, not waste.", bn: "© ২০২৬ ফ্ল্যাশভল্ট বিডি • সারপ্লাস, অপচয় নয়।" },
};

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("fv-lang") as Lang | null;
    if (saved) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("fv-lang", l);
  };

  const t = (k: string) => {
    const entry = tData[k];
    if (!entry) return k;
    return entry[lang] ?? entry.en;
  };

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
