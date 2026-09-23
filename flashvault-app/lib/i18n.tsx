"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "en" | "bn";

type Translations = Record<string, Record<Lang, string>>;

export const tData: Translations = {
  // Header
  "nav.vault": { en: "Vault", bn: "ভল্ট" },
  "nav.drop": { en: "Live Drop", bn: "লাইভ ড্রপ" },
  "nav.merchant": { en: "Merchants", bn: "বিক্রেতা" },
  "nav.enter": { en: "Enter Vault →", bn: "ভল্টে প্রবেশ করুন →" },
  "badge.friday": { en: "EVERY FRIDAY • 9PM • 1 HOUR ONLY", bn: "প্রতি শুক্রবার • রাত ৯টা • মাত্র ১ ঘণ্টা" },
  "badge.next": { en: "NEXT: FRI 9PM", bn: "পরবর্তী ড্রপ: শুক্রবার রাত ৯টা" },

  // Hero
  "hero.surplus": { en: "SURPLUS", bn: "উদ্বৃত্ত" },
  "hero.stocks": { en: "Stocks.", bn: "পণ্য।" },
  "hero.top": { en: "TOP", bn: "সেরা" },
  "hero.brands": { en: "BRANDS.", bn: "ব্র্যান্ডের।" },
  "hero.sub": { en: "80% OFF • Deadstock • VIP Access", bn: "৮০% পর্যন্ত ছাড় • অবিক্রীত পণ্য • বিশেষ অ্যাক্সেস" },
  "hero.desc": {
    en: "Bangladesh's most wanted 1-hour drop. We unlock surplus from top factories — once it's gone, it's vaulted forever.",
    bn: "বাংলাদেশের সবচেয়ে জনপ্রিয় ১ ঘণ্টার সেল। আমরা দেশের সেরা কারখানার উদ্বৃত্ত পণ্য নিয়ে আসি — একবার শেষ হলে আর পাওয়া যাবে না।",
  },
  "hero.nextDrop": { en: "Next Drop Unlocks In", bn: "পরবর্তী ড্রপ শুরু হবে" },
  "hero.enterVault": { en: "Enter Live Vault →", bn: "লাইভ ভল্টে প্রবেশ করুন →" },
  "hero.sellStock": { en: "Sell Your Stock", bn: "আপনার পণ্য বিক্রি করুন" },
  "hero.liveNow": { en: "LIVE NOW", bn: "এখন লাইভ" },
  "hero.avgDiscount": { en: "AVG DISCOUNT", bn: "গড় ছাড়" },
  "hero.soldPerDrop": { en: "SOLD / DROP", bn: "প্রতি ড্রপে বিক্রি" },

  // Sections
  "section.trusted": { en: "TRUSTED SURPLUS FROM", bn: "বিশ্বস্ত ব্র্যান্ডের উদ্বৃত্ত পণ্য" },
  "section.thisWeeks": { en: "THIS WEEK'S", bn: "এই সপ্তাহের" },
  "section.vaultDrops": { en: "Vault Drops", bn: "ভল্ট ড্রপ" },
  "section.vaultDesc": {
    en: "Curated deadstock, export leftovers, sample sets — authenticated, photographed, vaulted.",
    bn: "বাছাই করা অবিক্রীত পণ্য, রপ্তানির উদ্বৃত্ত, স্যাম্পল কালেকশন — যাচাইকৃত, ছবি তোলা ও ভল্টে সংরক্ষিত।",
  },
  "section.viewLive": { en: "VIEW LIVE DROP →", bn: "লাইভ ড্রপ দেখুন →" },
  "section.howItWorks": { en: "HOW IT WORKS", bn: "কীভাবে কাজ করে" },
  "section.notMarketplace": { en: "NOT A", bn: "এটি কোনো সাধারণ" },
  "section.marketplace": { en: "Marketplace.", bn: "মার্কেটপ্লেস নয়।" },
  "section.aVault": { en: "A VAULT.", bn: "এটি একটি ভল্ট।" },

  // How it works
  "how.01.title": { en: "Merchants submit surplus", bn: "বিক্রেতারা উদ্বৃত্ত পণ্য জমা দেন" },
  "how.01.desc": {
    en: "Factories, brands, wholesalers submit deadstock with real photos, stock count, and cost. We verify authenticity.",
    bn: "কারখানা, ব্র্যান্ড ও পাইকাররা আসল ছবি, মজুদের পরিমাণ এবং দাম সহ অবিক্রীত পণ্য জমা দেন। আমরা প্রতিটি পণ্যের সত্যতা যাচাই করি।",
  },
  "how.02.title": { en: "We curate & price to move", bn: "আমরা বাছাই করে দাম নির্ধারণ করি" },
  "how.02.desc": {
    en: "Admin approves only 12-18 pieces per drop. We set vault price (70-85% off) to guarantee sell-through in 1 hour.",
    bn: "অ্যাডমিন প্রতি ড্রপে মাত্র ১২-১৮টি পণ্য অনুমোদন করেন। আমরা ভল্টের দাম নির্ধারণ করি (৭০-৮৫% ছাড়) যাতে ১ ঘণ্টার মধ্যে সব বিক্রি হয়ে যায়।",
  },
  "how.03.title": { en: "Friday 9PM — Vault unlocks", bn: "শুক্রবার রাত ৯টা — ভল্ট খুলে যায়" },
  "how.03.desc": {
    en: "Live traffic 10k+, FOMO timer, stock counter, bKash checkout. Unsold returns to vault. No restock.",
    bn: "১০ হাজারের বেশি লাইভ দর্শক, সময় গণনা, মজুদের সংখ্যা, বিকাশে পেমেন্ট। যা বিক্রি হয় না, তা ভল্টে ফিরে যায়। পুনরায় মজুদ হয় না।",
  },

  // Drop
  "drop.live": { en: "LIVE DROP • FRI 9PM", bn: "লাইভ ড্রপ • শুক্রবার রাত ৯টা" },
  "drop.locked": { en: "LOCKED", bn: "বন্ধ" },
  "drop.unlocked": { en: "UNLOCKED", bn: "খোলা" },
  "drop.vaultLocked": { en: "VAULT IS LOCKED", bn: "ভল্ট বন্ধ আছে" },
  "drop.fridaySharp": { en: "FRIDAY 9PM SHARP.", bn: "শুক্রবার ঠিক রাত ৯টায়।" },
  "drop.testUnlock": { en: "Test Unlock →", bn: "পরীক্ষামূলক খুলুন →" },
  "drop.liveNow": { en: "LIVE NOW — 60 MIN", bn: "এখন লাইভ — ৬০ মিনিট" },

  // Footer
  "footer.copy": { en: "© 2026 FlashVault BD • Surplus, not waste.", bn: "© ২০২৬ ফ্ল্যাশভল্ট বিডি • উদ্বৃত্ত পণ্য, অপচয় নয়।" },
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
