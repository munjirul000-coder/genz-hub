import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flashvault-bd.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FlashVault BD — Surplus Stocks. Top Brands. Up to 80% Off. 1 Hour Only.",
    template: "%s | FlashVault BD",
  },
  description: "Bangladesh's premier 1-hour VIP Flash Drop platform. Every Friday 9 PM Asia/Dhaka, exclusive dead-stock from top BD clothing brands. Real discounts, server-enforced vault, no fake stats.",
  keywords: ["FlashVault", "BD surplus", "Bangladesh fashion", "deadstock", "Friday drop", "vault", "Aarong surplus", "Yellow surplus"],
  authors: [{ name: "FlashVault BD" }],
  creator: "FlashVault BD",
  publisher: "FlashVault BD",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_BD",
    url: siteUrl,
    title: "FlashVault BD — Surplus Stocks. Top Brands.",
    description: "Bangladesh's most wanted 1-hour drop. Real inventory, real discounts, server-enforced.",
    siteName: "FlashVault BD",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlashVault BD",
    description: "Bangladesh's premier 1-hour VIP Flash Drop",
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <style>{`
          :root {
            --font-bricolage: 'Bricolage Grotesque', system-ui, sans-serif;
            --font-instrument: 'Instrument Serif', serif;
            --font-jetbrains: 'JetBrains Mono', monospace;
          }
        `}</style>
      </head>
      <body className="font-sans antialiased min-h-screen bg-bg">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
