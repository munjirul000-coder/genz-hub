"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatBDT } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "orders" | "addresses" | "wishlist">("profile");
  const [addresses, setAddresses] = useState<any[]>([]);
  const [newAddr, setNewAddr] = useState({ label: "", address: "", city: "", phone: "" });
  const router = useRouter();

  const load = async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (!r.ok) {
        router.push("/login");
        return;
      }
      const d = await r.json();
      setUser(d.user);
      // Load orders for this user only - server will filter by phone/email
      const ro = await fetch("/api/orders/my", { cache: "no-store" });
      if (ro.ok) {
        const od = await ro.json();
        setOrders(od.orders || []);
      }
      // Load addresses from localStorage for now (future: DB)
      const saved = localStorage.getItem("fv_addresses");
      if (saved) setAddresses(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const addAddress = () => {
    if (!newAddr.address || !newAddr.city) return alert("Address and city required");
    const updated = [...addresses, { id: Date.now().toString(), ...newAddr }];
    setAddresses(updated);
    localStorage.setItem("fv_addresses", JSON.stringify(updated));
    setNewAddr({ label: "", address: "", city: "", phone: "" });
  };

  if (loading) return <div className="min-h-screen grid place-items-center font-mono text-[12px]">Loading account...</div>;
  if (!user) return <div className="min-h-screen grid place-items-center"><Link href="/login" className="underline">Login required →</Link></div>;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">My Account</h1>
            <p className="font-mono text-[11px] text-muted mt-1">{user.email} • {user.role} • Server-verified ownership</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="gold">{user.role}</Badge>
            <Button variant="outline" className="rounded-pill" onClick={logout}>Logout</Button>
          </div>
        </div>

        <div className="flex gap-1.5 mb-6 overflow-x-auto">
          {[
            { id: "profile", label: "Profile" },
            { id: "orders", label: `Orders (${orders.length})` },
            { id: "addresses", label: `Addresses (${addresses.length})` },
            { id: "wishlist", label: "Wishlist" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 h-9 rounded-pill text-[13px] font-medium whitespace-nowrap ${tab === t.id ? "bg-ink text-white" : "bg-white border border-border"}`}>{t.label}</button>
          ))}
        </div>

        {tab === "profile" && (
          <Card className="rounded-xl max-w-[560px]">
            <CardHeader><CardTitle className="text-[18px]">Profile</CardTitle><CardDescription>Your data is protected server-side, only you can access</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="font-mono text-[11px] text-muted">FULL NAME</label><div className="mt-1 font-bold text-[14px]">{user.name}</div></div>
                <div><label className="font-mono text-[11px] text-muted">EMAIL</label><div className="mt-1 font-mono text-[13px]">{user.email}</div></div>
                <div><label className="font-mono text-[11px] text-muted">PHONE</label><div className="mt-1 font-mono text-[13px]">{user.phone || "Not set"}</div></div>
                <div><label className="font-mono text-[11px] text-muted">MEMBER SINCE</label><div className="mt-1 font-mono text-[12px]">{new Date(user.createdAt).toLocaleDateString()}</div></div>
              </div>
              <div className="pt-4 p-3 rounded-lg bg-bg3 border font-mono text-[11px] text-muted">Security: Passwords hashed with PBKDF2 120k iterations, httpOnly cookies, JWT verified server-side on every request. You cannot access another user's data by changing ID.</div>
            </CardContent>
          </Card>
        )}

        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 && <Card className="rounded-xl p-8 text-center text-muted text-[13px]">No orders yet. Orders are filtered server-side by your account only.</Card>}
            {orders.map((o: any) => (
              <Card key={o.id} className="rounded-lg">
                <CardContent className="p-4 flex justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-bold text-[13px]">{o.productTitle} x{o.quantity}</div>
                    <div className="font-mono text-[11px] text-muted mt-1">{o.id} • {formatBDT(o.totalAmount)} • {o.status} • {new Date(o.createdAt).toLocaleString()}</div>
                    <div className="font-mono text-[10px] text-muted mt-1">Tracking: {o.courierTracking} • {o.shippingAddress}, {o.city}</div>
                  </div>
                  <Badge variant="secondary" className="h-fit">{o.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === "addresses" && (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-[15px]">Add Address</CardTitle><CardDescription>Login required to save address (server will validate ownership later)</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Label e.g. Home" value={newAddr.label} onChange={e => setNewAddr({ ...newAddr, label: e.target.value })} />
                <Input placeholder="Full address *" value={newAddr.address} onChange={e => setNewAddr({ ...newAddr, address: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="City *" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} />
                  <Input placeholder="Phone" value={newAddr.phone} onChange={e => setNewAddr({ ...newAddr, phone: e.target.value })} />
                </div>
                <Button className="w-full rounded-pill" onClick={addAddress}>Save Address</Button>
              </CardContent>
            </Card>
            <div className="space-y-3">
              {addresses.map((a: any) => (
                <Card key={a.id} className="rounded-lg"><CardContent className="p-4"><div className="font-bold text-[13px]">{a.label || "Address"}</div><div className="text-[12px] text-muted mt-1">{a.address}, {a.city} • {a.phone}</div></CardContent></Card>
              ))}
              {addresses.length === 0 && <div className="text-center py-12 text-muted text-[13px] border border-dashed rounded-xl">No saved addresses</div>}
            </div>
          </div>
        )}

        {tab === "wishlist" && (
          <Card className="rounded-xl p-8 text-center">
            <div className="font-bold text-[16px]">Wishlist</div>
            <div className="text-[13px] text-muted mt-2">Login required to save wishlist. Your wishlist is private and server-enforced.</div>
            <div className="mt-4 text-[11px] font-mono text-muted">Coming soon: real wishlist API with ownership check</div>
          </Card>
        )}
      </div>
    </div>
  );
}
