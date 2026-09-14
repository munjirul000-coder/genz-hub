"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SuperAdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(async r => {
      if (!r.ok) {
        router.push("/login");
        return;
      }
      const d = await r.json();
      if (!d.user) {
        router.push("/login");
        return;
      }
      if (d.user.role !== "SUPER_ADMIN") {
        setError(`Forbidden - Your role is ${d.user.role}, SUPER_ADMIN required`);
        setLoading(false);
        return;
      }
      setUser(d.user);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center font-mono text-[12px]">Checking SUPER_ADMIN access...</div>;

  if (error) {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 grid place-items-center mx-auto text-[24px]">🚫</div>
          <h1 className="mt-6 text-[28px] font-extrabold tracking-tight">{error}</h1>
          <p className="mt-3 text-muted">Super Admin area is protected server-side. Customers and Merchants have zero access.</p>
          <Button className="mt-6 rounded-pill" onClick={() => router.push("/")}>Back to Vault</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] py-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-[28px] font-extrabold tracking-tight">Super Admin OS</h1>
          <Badge variant="gold">SUPER_ADMIN</Badge>
          <Badge variant="secondary">{user.email}</Badge>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-[16px]">Platform Control</CardTitle><CardDescription>Highest permissions - server-enforced</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <div className="flex justify-between border-b py-2"><span>Role</span><span className="font-bold">{user.role}</span></div>
              <div className="flex justify-between border-b py-2"><span>Email</span><span>{user.email}</span></div>
              <div className="flex justify-between py-2"><span>ID</span><span className="font-mono text-[11px]">{user.id}</span></div>
              <div className="mt-4 p-3 rounded bg-bg3 border font-mono text-[11px] text-muted">This page verifies JWT server-side via /api/auth/me. If role != SUPER_ADMIN, 403. No frontend bypass possible.</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-[16px]">Quick Links</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="rounded-pill justify-start" onClick={() => window.location.href = "/admin"}>Go to Admin Dashboard →</Button>
              <Button variant="outline" className="rounded-pill justify-start" onClick={() => window.location.href = "/account"}>My Account →</Button>
              <Button variant="outline" className="rounded-pill justify-start" onClick={() => fetch("/api/auth/init-super-admin").then(r=>r.json()).then(d=>alert(JSON.stringify(d,null,2)))}>Check Super Admins</Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-ink text-white/70 font-mono text-[11px] leading-[1.6]">
          SUPER_ADMIN can manage Users, Merchants, Products, Drops, Orders, Reports, Settings, Audit Logs. All actions logged. Role cannot be changed via frontend.
        </div>
      </div>
    </div>
  );
}
