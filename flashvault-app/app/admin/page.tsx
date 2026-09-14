"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatBDT } from "@/lib/utils";
import { ADMIN_KEY_STORAGE } from "@/lib/auth-constants";

type Tab = "overview" | "products" | "merchants" | "drops" | "orders" | "audit" | "settings";

type StatsData = any;

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string>("ADMIN");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [rejectionReason, setRejectionReason] = useState("");

  // Drop create form
  const [dropForm, setDropForm] = useState({ title: "", scheduledAt: "", duration: "60", productIds: "" });

  const authHeader = () => ({ "x-admin-key": localStorage.getItem(ADMIN_KEY_STORAGE) || key });

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/stats", { headers: authHeader() });
      if (r.status === 401) {
        setAuthed(false);
        localStorage.removeItem(ADMIN_KEY_STORAGE);
        alert("Invalid admin key - server rejected");
        return;
      }
      const d = await r.json();
      setStats(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) {
      setKey(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      load();
      const id = setInterval(load, 15000);
      return () => clearInterval(id);
    }
  }, [authed]);

  const handleLogin = () => {
    if (!key.trim()) return alert("Enter admin key");
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
    // Verify via API
    fetch("/api/admin/stats", { headers: { "x-admin-key": key } }).then(r => {
      if (r.ok) {
        setAuthed(true);
        r.json().then(d => {
          // Detect role by key
          if (key.includes("SUPER")) setRole("SUPER_ADMIN");
          else setRole("ADMIN");
        });
      } else {
        alert("Wrong key - server says unauthorized");
      }
    });
  };

  const toggleLock = async () => {
    if (!stats) return;
    const newLock = !stats.drop.isLocked;
    const r = await fetch("/api/drop/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ isLocked: newLock }),
    });
    if (r.ok) load();
    else alert("Failed to toggle");
  };

  const approveProduct = async (id: string, action: string, reason?: string) => {
    const r = await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ id, action, reason }),
    });
    if (r.ok) load();
    else {
      const err = await r.json();
      alert(err.error || "Failed");
    }
  };

  const updateMerchant = async (id: string, action: string) => {
    const r = await fetch("/api/admin/merchants", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ id, action, reason: rejectionReason }),
    });
    if (r.ok) load();
  };

  const updateOrder = async (id: string, status: string) => {
    const r = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ id, status }),
    });
    if (r.ok) load();
  };

  const createDrop = async () => {
    if (!dropForm.title || !dropForm.scheduledAt) return alert("Title and date required");
    const scheduledAt = new Date(dropForm.scheduledAt).getTime();
    const productIds = dropForm.productIds.split(",").map(s => s.trim()).filter(Boolean);
    if (productIds.length === 0) return alert("At least 1 product ID required");

    const r = await fetch("/api/admin/drops", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        title: dropForm.title,
        scheduledAt,
        durationMinutes: Number(dropForm.duration),
        productIds,
      }),
    });
    if (r.ok) {
      alert("Drop created");
      setDropForm({ title: "", scheduledAt: "", duration: "60", productIds: "" });
      load();
    } else {
      const err = await r.json();
      alert(err.error || "Failed to create drop");
    }
  };

  const filteredProducts = (() => {
    if (!stats?.products) return [];
    let list = stats.products as any[];
    if (filterStatus !== "all") list = list.filter(p => p.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s) || p.id.includes(s));
    }
    return list;
  })();

  if (!authed) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center p-6">
        <Card className="w-full max-w-[420px] rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-[22px] tracking-tight">🔐 Super Admin</CardTitle>
            <CardDescription>Server-side RBAC enforced. Key verified via API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="font-mono text-[11px] text-muted">ADMIN KEY</label>
              <Input type="password" placeholder="Enter ADMIN_KEY or SUPER_ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} className="mt-2" />
              <p className="mt-2 font-mono text-[10px] text-muted">Default: FLASHVAULT2026 (set ADMIN_KEY & SUPER_ADMIN_KEY in env for prod)</p>
            </div>
            <Button className="w-full rounded-pill" onClick={handleLogin}>Unlock Dashboard →</Button>
            <div className="p-3 rounded-md bg-bg3 border text-[11px] leading-[1.5] text-muted">
              <strong>Security:</strong> Key checked server-side on every request. Frontend cannot bypass RBAC. Audit logs recorded.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7]">
      <Header />
      <div className="max-w-[1440px] mx-auto px-[20px] sm:px-[28px] py-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-[-0.04em] flex items-center gap-3">
              Admin OS
              <Badge variant="secondary" className="text-[10px]">{role}</Badge>
              <Badge variant={stats?.drop.computed?.isLive ? "gold" : "secondary"} className="text-[10px]">
                {stats?.drop.computed?.state || "LOADING"}
              </Badge>
            </h1>
            <p className="font-mono text-[11px] text-muted mt-1">Real data • Server-enforced • Asia/Dhaka • Auto-refresh 15s • {stats?.drop.liveTraffic?.toLocaleString()} online</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-pill" onClick={load} disabled={loading}>{loading ? "..." : "Refresh"}</Button>
            <Button variant="outline" className="rounded-pill" onClick={() => { localStorage.removeItem(ADMIN_KEY_STORAGE); setAuthed(false); }}>Logout</Button>
            <Button className={`rounded-pill ${stats?.drop.isLocked ? "bg-ink" : "bg-emerald-600 hover:bg-emerald-700"}`} onClick={toggleLock}>
              {stats?.drop.isLocked ? "🔒 UNLOCK NOW" : "🔓 LOCK NOW"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2">
          {[
            { id: "overview", label: "Overview" },
            { id: "products", label: `Products (${stats?.stats?.totalProducts ?? 0})` },
            { id: "merchants", label: `Merchants (${stats?.stats?.totalMerchants ?? 0})` },
            { id: "drops", label: "Drops" },
            { id: "orders", label: `Orders (${stats?.stats?.totalOrders ?? 0})` },
            { id: "audit", label: "Audit Logs" },
            { id: "settings", label: "Settings" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`px-4 h-9 rounded-pill text-[13px] font-medium whitespace-nowrap transition ${tab === t.id ? "bg-ink text-white" : "bg-white border border-border hover:bg-bg3"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Sales (Real)", value: formatBDT(stats.stats.totalSales), sub: `${stats.stats.completedOrders} completed` },
                { label: "Platform Revenue 10%", value: formatBDT(stats.stats.platformRevenue), sub: `Merchant: ${formatBDT(stats.stats.merchantEarnings)}` },
                { label: "Live Products", value: `${stats.stats.liveProducts} live`, sub: `${stats.stats.pendingProducts} pending • ${stats.stats.totalStock} stock` },
                { label: "Avg Discount (Real)", value: `${stats.stats.avgDiscount}%`, sub: `${stats.stats.totalSold} sold total` },
                { label: "Total Orders", value: `${stats.stats.totalOrders}`, sub: `${stats.stats.cancelledOrders} cancelled` },
                { label: "Merchants", value: `${stats.stats.verifiedMerchants}/${stats.stats.totalMerchants}`, sub: "verified / total" },
                { label: "Drop State", value: stats.drop.computed?.state || "—", sub: stats.drop.computed?.isLive ? `Ends ${new Date(stats.drop.computed.liveEndsAt).toLocaleTimeString()}` : `Next ${new Date(stats.drop.computed?.nextDropAt).toLocaleString()}` },
                { label: "Timezone", value: stats.settings.timezone, sub: `Fri ${stats.settings.dropDay} ${stats.settings.dropStartHour}:00 • ${stats.settings.dropDurationMinutes}min` },
              ].map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="rounded-lg shadow-sm">
                    <CardContent className="p-4">
                      <div className="font-mono text-[10px] tracking-wide text-muted uppercase">{c.label}</div>
                      <div className="mt-1 font-bold text-[18px] tracking-tight">{c.value}</div>
                      <div className="text-[11px] text-muted mt-1">{c.sub}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="rounded-xl">
                <CardHeader><CardTitle className="text-[15px]">Pending Approval Queue</CardTitle><CardDescription>Server-calculated discount • suspicious flagged</CardDescription></CardHeader>
                <CardContent className="space-y-2 max-h-[400px] overflow-auto">
                  {(stats.pending || []).slice(0, 8).map((p: any) => (
                    <div key={p.id} className="flex gap-3 p-3 border rounded-lg bg-white">
                      <img src={p.image} alt="" className="w-12 h-14 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[12px] truncate">{p.title}</div>
                        <div className="font-mono text-[10px] text-muted">{p.brand} • ৳{p.vaultPrice} (orig ৳{p.originalPrice}) • {p.discountPercent}% OFF • {p.stock} pcs {p.verificationStatus === "suspicious" && "⚠️ SUSPICIOUS"}</div>
                        <div className="mt-2 flex gap-1.5">
                          <Button size="sm" className="h-6 text-[10px] rounded-pill" onClick={() => approveProduct(p.id, "approve")}>Approve</Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-pill" onClick={() => approveProduct(p.id, "live")}>Live</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] rounded-pill" onClick={() => { const r = prompt("Rejection reason"); if (r) approveProduct(p.id, "reject", r); }}>Reject</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!stats.pending || stats.pending.length === 0) && <div className="text-center py-8 text-muted text-[13px]">No pending</div>}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader><CardTitle className="text-[15px]">Recent Orders (Real)</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[400px] overflow-auto">
                  {(stats.orders || []).slice(0, 8).map((o: any) => (
                    <div key={o.id} className="p-3 border rounded-lg bg-white">
                      <div className="flex justify-between"><span className="font-bold text-[12px]">{o.productTitle.slice(0, 30)}</span><Badge variant="secondary" className="text-[9px]">{o.status}</Badge></div>
                      <div className="font-mono text-[10px] text-muted mt-1">{formatBDT(o.totalAmount)} • {o.customerPhone} • {o.city} • {o.courierTracking}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Products */}
        {tab === "products" && stats && (
          <div className="space-y-4">
            <Card className="rounded-xl">
              <CardContent className="p-4 flex flex-wrap gap-3">
                <Input placeholder="Search title, brand, id..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-[260px] h-9" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-border bg-white px-3 text-[13px]">
                  <option value="all">All status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="live">Live</option>
                  <option value="rejected">Rejected</option>
                  <option value="soldout">Soldout</option>
                  <option value="suspended">Suspended</option>
                </select>
                <div className="ml-auto font-mono text-[11px] text-muted py-2">{filteredProducts.length} products</div>
              </CardContent>
            </Card>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((p: any) => (
                <Card key={p.id} className="rounded-lg overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <img src={p.image} alt="" className="w-14 h-18 object-cover rounded bg-bg3" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] leading-tight line-clamp-2">{p.title}</div>
                      <div className="mt-1 flex gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[9px]">{p.status}</Badge>
                        <Badge variant={p.verificationStatus === "suspicious" ? "default" : "gold"} className="text-[9px]">{p.verificationStatus}</Badge>
                        <span className="font-mono text-[10px] text-muted">{p.discountPercent}% OFF • {p.availableQuantity} left</span>
                      </div>
                      <div className="font-mono text-[10px] text-muted mt-1">৳{p.vaultPrice} / ৳{p.originalPrice} • {p.merchantId}</div>
                      {p.rejectionReason && <div className="text-[10px] text-red-600 mt-1">Reason: {p.rejectionReason}</div>}
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <Button size="sm" className="h-6 px-2 text-[10px] rounded-pill" onClick={() => approveProduct(p.id, "approve")}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] rounded-pill" onClick={() => approveProduct(p.id, "live")}>Live</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] rounded-pill" onClick={() => approveProduct(p.id, "suspend", "Quality issue")}>Suspend</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] rounded-pill" onClick={() => { const r = prompt("Reject reason", p.rejectionReason || ""); if (r !== null) approveProduct(p.id, "reject", r); }}>Reject</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Merchants */}
        {tab === "merchants" && stats && (
          <div className="grid gap-3">
            {(stats.merchants || []).map((m: any) => (
              <Card key={m.id} className="rounded-lg">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <div className="font-bold text-[14px]">{m.brand} • {m.name}</div>
                    <div className="font-mono text-[11px] text-muted">{m.phone} • {m.id} • {m.status} • Sales {formatBDT(m.totalSales)} • {m.totalOrders} orders • Payout {formatBDT(m.payoutBalance)}</div>
                    {m.suspendedReason && <div className="text-[11px] text-red-600 mt-1">{m.suspendedReason}</div>}
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant={m.status === "approved" ? "gold" : m.status === "suspended" ? "default" : "secondary"}>{m.status}</Badge>
                    <Button size="sm" className="h-7 text-[11px] rounded-pill" onClick={() => updateMerchant(m.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-pill" onClick={() => updateMerchant(m.id, "suspend")}>Suspend</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] rounded-pill" onClick={() => updateMerchant(m.id, "reactivate")}>Reactivate</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Drops */}
        {tab === "drops" && stats && (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-[15px]">Create Drop (Asia/Dhaka)</CardTitle><CardDescription>Schedule next Friday drop, assign products</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div><label className="font-mono text-[11px] text-muted">TITLE</label><Input value={dropForm.title} onChange={e => setDropForm({ ...dropForm, title: e.target.value })} placeholder="Friday Night Vault" className="mt-1" /></div>
                <div><label className="font-mono text-[11px] text-muted">SCHEDULED AT (local)</label><Input type="datetime-local" value={dropForm.scheduledAt} onChange={e => setDropForm({ ...dropForm, scheduledAt: e.target.value })} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="font-mono text-[11px] text-muted">DURATION MIN</label><Input type="number" value={dropForm.duration} onChange={e => setDropForm({ ...dropForm, duration: e.target.value })} className="mt-1" /></div>
                  <div><label className="font-mono text-[11px] text-muted">PRODUCT IDS (comma)</label><Input value={dropForm.productIds} onChange={e => setDropForm({ ...dropForm, productIds: e.target.value })} placeholder="p1,p2,p3" className="mt-1" /></div>
                </div>
                <Button className="w-full rounded-pill" onClick={createDrop}>Create Drop</Button>
                <div className="text-[11px] text-muted font-mono">Server time: {new Date().toString()} • Dhaka: Asia/Dhaka UTC+6</div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-[15px]">Scheduled Drops</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-auto">
                {(stats.drops || []).map((d: any) => (
                  <div key={d.id} className="p-3 border rounded-lg bg-white">
                    <div className="flex justify-between"><span className="font-bold text-[12px]">{d.title}</span><Badge variant="secondary" className="text-[9px]">{d.status}</Badge></div>
                    <div className="font-mono text-[10px] text-muted mt-1">{new Date(d.scheduledAt).toLocaleString()} • {d.durationMinutes}min • {d.productIds.length} products • {d.id}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders */}
        {tab === "orders" && stats && (
          <div className="space-y-3">
            <Card className="rounded-xl"><CardContent className="p-4 font-mono text-[11px] text-muted">Real orders only • Inventory safely reserved • Idempotency protected • No overselling</CardContent></Card>
            {(stats.orders || []).map((o: any) => (
              <Card key={o.id} className="rounded-lg">
                <CardContent className="p-4 flex flex-wrap gap-4 justify-between">
                  <div>
                    <div className="font-bold text-[13px]">{o.productTitle} x{o.quantity}</div>
                    <div className="font-mono text-[11px] text-muted">{o.id} • {formatBDT(o.totalAmount)} (prod {formatBDT(o.amount)} + ship {formatBDT(o.deliveryFee)}) • {o.customerPhone} • {o.city} • {o.courierTracking}</div>
                    <div className="font-mono text-[10px] text-muted mt-1">{new Date(o.createdAt).toLocaleString()} • Pay: {o.paymentStatus} • Delivery: {o.deliveryStatus}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap items-start">
                    <Badge variant="secondary">{o.status}</Badge>
                    <Button size="sm" className="h-7 text-[10px] rounded-pill" onClick={() => updateOrder(o.id, "confirmed")}>Confirm</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-pill" onClick={() => updateOrder(o.id, "shipped")}>Shipped</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-pill" onClick={() => updateOrder(o.id, "delivered")}>Delivered</Button>
                    <Button size="sm" className="h-7 text-[10px] rounded-pill bg-emerald-600" disabled={o.status !== "delivered"} onClick={() => updateOrder(o.id, "payout_released")}>Payout</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] rounded-pill" onClick={() => updateOrder(o.id, "cancelled")}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Audit */}
        {tab === "audit" && stats && (
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-[15px]">Audit Logs (Last 50)</CardTitle><CardDescription>Who did what, when — server-recorded</CardDescription></CardHeader>
            <CardContent className="space-y-1 max-h-[600px] overflow-auto font-mono text-[11px]">
              {(stats.auditLogs || []).map((log: any) => (
                <div key={log.id} className="flex gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="font-bold">{log.actorRole}</span>
                  <span className="px-1.5 py-0.5 rounded bg-bg3">{log.action}</span>
                  <span>{log.targetType} {log.targetId}</span>
                  <span className="text-muted truncate">{JSON.stringify(log.metadata || {}).slice(0, 80)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Settings */}
        {tab === "settings" && stats && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-[15px]">Platform Settings</CardTitle></CardHeader>
              <CardContent className="space-y-2 font-mono text-[12px]">
                <div className="flex justify-between border-b py-2"><span>Platform</span><span className="font-bold">{stats.settings.platformName}</span></div>
                <div className="flex justify-between border-b py-2"><span>Currency</span><span>{stats.settings.currency}</span></div>
                <div className="flex justify-between border-b py-2"><span>Timezone</span><span>{stats.settings.timezone}</span></div>
                <div className="flex justify-between border-b py-2"><span>Drop Day</span><span>Friday ({stats.settings.dropDay})</span></div>
                <div className="flex justify-between border-b py-2"><span>Start</span><span>{stats.settings.dropStartHour}:{String(stats.settings.dropStartMinute).padStart(2, "0")}</span></div>
                <div className="flex justify-between border-b py-2"><span>Duration</span><span>{stats.settings.dropDurationMinutes} min</span></div>
                <div className="flex justify-between border-b py-2"><span>Commission</span><span>{stats.settings.commissionPercent}%</span></div>
                <div className="flex justify-between py-2"><span>Maintenance</span><span>{stats.settings.maintenanceMode ? "ON" : "OFF"}</span></div>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-[15px]">Env Vars Required</CardTitle></CardHeader>
              <CardContent className="space-y-2 font-mono text-[11px] leading-[1.6]">
                <div><strong>ADMIN_KEY</strong>=FLASHVAULT2026 (change in prod)</div>
                <div><strong>SUPER_ADMIN_KEY</strong>=FLASHVAULT_SUPER_2026</div>
                <div><strong>PLATFORM_TIMEZONE</strong>=Asia/Dhaka</div>
                <div><strong>COMMISSION_PERCENT</strong>=10</div>
                <div className="mt-3 p-3 bg-bg3 rounded text-[11px]">All admin APIs verify x-admin-key server-side. Never expose keys to client env NEXT_PUBLIC_*. Use httpOnly cookie in future + JWT.</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-8 p-4 rounded-lg bg-ink text-white/60 font-mono text-[11px] leading-[1.6]">
          <strong className="text-white">Security:</strong> RBAC enforced server-side • Rate limiting 10-60 req/min • Audit logs • Inventory mutex • Idempotency keys • Real discount calc • No fake stats • Drop state computed from server time Asia/Dhaka • Purchase blocked when locked.
        </div>
      </div>
    </div>
  );
}
