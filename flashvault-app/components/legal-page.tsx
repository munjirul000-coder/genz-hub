import Link from "next/link";
import { Header } from "@/components/header";

type LegalPageProps = {
  title: string;
  subtitle: string;
  updated?: string;
  children: React.ReactNode;
};

export function LegalSection({ h, children }: { h: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] sm:text-[17px] font-bold tracking-[-0.01em] mb-2.5">{h}</h2>
      <div className="space-y-2 text-[13.5px] leading-relaxed text-ink/75">{children}</div>
    </section>
  );
}

export function LegalPage({ title, subtitle, updated = "26 October 2026", children }: LegalPageProps) {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-ink text-white">
        <div className="max-w-[840px] mx-auto px-[20px] sm:px-[28px] py-12 sm:py-16">
          <p className="font-mono text-[10px] tracking-[0.22em] text-gold uppercase mb-3">FlashVault BD</p>
          <h1 className="text-[32px] sm:text-[44px] font-bold tracking-[-0.03em] leading-[1.05]">{title}</h1>
          <p className="text-white/60 mt-4 text-[13.5px] max-w-[560px] leading-relaxed">{subtitle}</p>
        </div>
      </div>
      <div className="max-w-[840px] mx-auto px-[20px] sm:px-[28px] py-10 sm:py-14 space-y-9">
        {children}
        <div className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-muted">Last updated: {updated} • FlashVault BD, Dhaka, Bangladesh</p>
          <div className="flex gap-4 font-mono text-[11px] text-muted">
            <Link href="/terms" className="hover:text-ink underline underline-offset-2">Terms</Link>
            <Link href="/privacy" className="hover:text-ink underline underline-offset-2">Privacy</Link>
            <Link href="/refund" className="hover:text-ink underline underline-offset-2">Refund</Link>
            <Link href="/contact" className="hover:text-ink underline underline-offset-2">Contact</Link>
          </div>
        </div>
      </div>
      <footer className="bg-ink text-white/50 border-t border-white/10">
        <div className="max-w-[840px] mx-auto px-[20px] sm:px-[28px] h-[64px] flex items-center justify-between text-[12px] font-mono">
          <span>© 2026 FlashVault BD • Surplus, not waste.</span>
          <Link href="/" className="hover:text-white transition-colors">flashvault</Link>
        </div>
      </footer>
    </div>
  );
}
