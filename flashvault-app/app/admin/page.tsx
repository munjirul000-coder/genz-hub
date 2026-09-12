"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatBDT } from "@/lib/utils";

type Stats = {
  totalGross: number;
  commission: number;
  liveTraffic: number;
  drop: { isLocked: boolean; nextDropAt: number };
  pending: any[];
  orders: any[];
  products: any[];
};

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/admin/stats");
    const d = await r.json();
    setStats(d);
    setLoading(false);
  };

  useEffect(() => {
    if (authed) {
      load();
      const id = setInterval(load, 4000);
      return () => clearInterval(id);
    }
  }, [authed]);

  const toggleLock = async () => {
    if (!stats) return;
    await fetch("/api/drop/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !stats.drop.isLocked }),
    });
    load();
  };

  const approve = async (id: string, action: string) => {
    await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center p-6">
        <Card className="w-full max-w-[400px] rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-[20px]">Secret Admin</CardTitle>
            <CardDescription>Enter key: FLASHVAULT2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} />
            <Button
              className="w-full rounded-pill"
              onClick={() => {
                if (key === "FLASHVAULT2026") setAuthed(true);
                else alert("Wrong key");
              }}
            >
              Unlock Dashboard →
            </Button>
            <p className="text-center font-mono text-[10px] text-muted">Demo key hardcoded for preview</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-0.04em]">Secret Admin Dashboard</h1>
            <p className="text-muted text-[13px] font-mono mt-1">LIVE • {stats?.liveTraffic.toLocaleString()} ONLINE • AUTO-REFRESH 4s</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-pill" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              className={`rounded-pill ${stats?.drop.isLocked ? "bg-ink" : "bg-emerald-600 hover:bg-emerald-700"}`}
              onClick={toggleLock}
            >
              {stats?.drop.isLocked ? "🔒 FORCE UNLOCK" : "🔓 FORCE LOCK"}
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Gross Sales", value: formatBDT(stats?.totalGross ?? 0), sub: "BDT lifetime", color: "bg-bg2" },
            { label: "Platform Commission 10%", value: formatBDT(stats?.commission ?? 0), sub: "Your cut", color: "bg-goldLight" },
            { label: "Live Traffic", value: `${stats?.liveTraffic.toLocaleString() ?? "—"} online`, sub: "Simulated 14,230", color: "bg-bg2" },
            {
              label: "Active Drop Status",
              value: stats?.drop.isLocked ? "LOCKED" : "UNLOCKED",
              sub: stats?.drop.isLocked ? "Next Fri 9PM" : "Live now",
              color: stats?.drop.isLocked ? "bg-bg2" : "bg-emerald-50",
            },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`rounded-lg shadow-sm ${c.color}`}>
                <CardContent className="p-5">
                  <div className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">{c.label}</div>
                  <div className="mt-2 font-bold text-[20px] tracking-[-0.02em]">{c.value}</div>
                  <div className="mt-1 text-[11px] text-muted">{c.sub}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          {/* Approval Queue */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Product Approval Queue <Badge variant="secondary">{stats?.pending.length ?? 0}</Badge>
              </CardTitle>
              <CardDescription>Merchant submissions — Approve for Next Drop / Reject / Adjust Price-Stock</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[560px] overflow-auto">
              {(stats?.pending ?? []).map((p: any) => (
                <div key={p.id} className="flex gap-4 p-3 border border-border rounded-lg bg-bg2">
                  <img src={p.image} alt={p.title} className="w-14 h-18 rounded-md object-cover bg-bg3" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[13px] truncate">{p.title}</div>
                    <div className="font-mono text-[11px] text-muted mt-1">
                      {p.brand} • {p.category} • ৳{p.vaultPrice} (orig ৳{p.originalPrice}) • {p.stock} pcs
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="h-7 rounded-pill text-[11px]" onClick={() => approve(p.id, "approve")}>
                        Approve for Next Drop
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 rounded-pill text-[11px]" onClick={() => approve(p.id, "live")}>
                        Make Live
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 rounded-pill text-[11px]" onClick={() => approve(p.id, "reject")}>
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {(!stats?.pending || stats.pending.length === 0) && <div className="text-center py-8 text-muted text-[13px]">No pending submissions</div>}
            </CardContent>
          </Card>

          {/* Escrow & Payout */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Escrow & Payout Manager</CardTitle>
              <CardDescription>Payment Status → Courier Tracking → Release Payout (only when delivered)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[560px] overflow-auto">
              {(stats?.orders ?? []).map((o: any) => (
                <div key={o.id} className="p-3 border border-border rounded-lg bg-bg2">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-bold text-[13px]">{o.productTitle}</div>
                      <div className="font-mono text-[11px] text-muted mt-1">
                        {formatBDT(o.amount)} • Commission {formatBDT(o.commission)} • {o.customerPhone}
                      </div>
                    </div>
                    <Badge variant={o.status === "delivered" ? "gold" : o.status === "shipped" ? "secondary" : "default"}>{o.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-muted">Courier:</span>
                    <span className="font-medium">{o.courierTracking ?? "—"}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 rounded-pill text-[11px]"
                      disabled={o.status !== "delivered"}
                      onClick={() => alert(`Payout released for ${o.id} — ৳${o.amount - o.commission} to merchant`)}
                    >
                      {o.status === "delivered" ? "Release Payout" : "Awaiting Delivery"}
                    </Button>
                    <span className="text-[11px] text-muted py-1.5">Escrow: {o.status === "delivered" ? "Ready" : "Locked"}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-bg3 border border-border font-mono text-[11px] leading-[1.6] text-muted">
          <strong className="text-ink">Flow:</strong> Merchant submits → Admin approves → Product goes live on /drop (toggle lock) → Customer bKash pays → Order in Escrow (paid → shipped → delivered) → Admin clicks Release Payout only when courier confirms delivery.
        </div>
      </div>
    </div>
  );
}
