"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLang();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const nav = [
    { href: "/", label: "Vault", icon: "◫" },
    { href: "/drop", label: "Live Drop", icon: "◉", live: true },
    { href: "/merchant", label: "Sell on FlashVault", icon: "⚡" },
    { href: "/account", label: "My Account", icon: "◍", auth: true },
    { href: "/admin", label: "Admin", icon: "⚙", roles: ["ADMIN", "SUPER_ADMIN"] },
    { href: "/super-admin", label: "Super Admin", icon: "◈", roles: ["SUPER_ADMIN"] },
  ];

  const filtered = nav.filter(n => {
    if (n.auth && !user) return false;
    if (n.roles && (!user || !n.roles.includes(user.role))) return false;
    return true;
  });

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden w-10 h-10 rounded-full bg-ink text-white grid place-items-center shadow-sm relative z-[60]"
        aria-label="Menu"
      >
        <div className="w-4 h-3 flex flex-col justify-between">
          <motion.span animate={{ rotate: open ? 45 : 0, y: open ? 4 : 0 }} className="block h-[2px] bg-white rounded-full" />
          <motion.span animate={{ opacity: open ? 0 : 1 }} className="block h-[2px] bg-white rounded-full" />
          <motion.span animate={{ rotate: open ? -45 : 0, y: open ? -4 : 0 }} className="block h-[2px] bg-white rounded-full" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[85%] max-w-[360px] bg-bg border-l border-border z-[56] md:hidden flex flex-col shadow-2xl"
            >
              <div className="h-[72px] flex items-center justify-between px-6 border-b border-border">
                <Link href="/" className="flex items-center gap-2 font-extrabold text-[18px]">
                  <div className="w-8 h-8 rounded-lg bg-ink text-bg grid place-items-center font-mono text-[12px]">FV</div>
                  FLASH<span className="font-serif font-normal italic">Vault</span>
                </Link>
                <Badge variant="live" className="gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filtered.map(item => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 h-[48px] rounded-xl text-[14px] font-medium transition ${active ? "bg-ink text-white shadow-sm" : "hover:bg-bg3 text-ink2"}`}
                    >
                      <span className="text-[16px] w-6 text-center">{item.icon}</span>
                      {item.label}
                      {item.live && <Badge variant="gold" className="ml-auto text-[10px]">LIVE</Badge>}
                    </Link>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-border space-y-2">
                  <div className="px-4 py-3 rounded-xl bg-bg2 border border-border">
                    <div className="font-mono text-[10px] text-muted tracking-wide uppercase">Vault Status</div>
                    <div className="mt-1 flex items-center gap-2 font-bold text-[13px]"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />Friday 9PM Asia/Dhaka</div>
                    <div className="mt-1 font-mono text-[11px] text-muted">Real inventory • Server-enforced</div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border space-y-3">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center font-bold text-[13px]">{user.name?.[0]?.toUpperCase()}</div>
                      <div>
                        <div className="font-bold text-[13px]">{user.name}</div>
                        <div className="font-mono text-[11px] text-muted">{user.role}</div>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full rounded-pill" onClick={() => { logout(); setOpen(false); }}>Logout</Button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block"><Button variant="outline" className="w-full rounded-pill">Login</Button></Link>
                    <Link href="/signup" className="block"><Button className="w-full rounded-pill">Sign Up →</Button></Link>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
