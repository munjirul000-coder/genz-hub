"use client";
import { motion } from "framer-motion";
import { useLang } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-1 rounded-pill bg-bg3 border border-border">
      {(["en", "bn"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className="relative px-2.5 py-1 rounded-pill text-[11px] font-bold tracking-wide transition-colors"
        >
          {lang === l && (
            <motion.div layoutId="langActive" className="absolute inset-0 bg-ink rounded-pill shadow-sm" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span className={`relative z-10 ${lang === l ? "text-bg" : "text-muted hover:text-ink"}`}>{l === "en" ? "EN" : "বাং"}</span>
        </button>
      ))}
    </div>
  );
}
