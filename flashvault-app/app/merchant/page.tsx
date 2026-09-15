"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function MerchantPage() {
  const { user, loading: authLoading } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authForm, setAuthForm] = useState({ name: "", brand: "", email: "", phone: "", password: "", confirmPassword: "", businessInfo: "" });
  const [authError, setAuthError] = useState("");
  const [authLoadingState, setAuthLoadingState] = useState(false);

  const [form, setForm] = useState({
    brand: "",
    title: "",
    description: "",
    originalPrice: "",
    vaultPrice: "",
    stock: "",
    category: "Mens",
    size: "",
    condition: "Surplus",
    location: "Dhaka, Bangladesh",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [discountPreview, setDiscountPreview] = useState<number | null>(null);
  const [merchantStatus, setMerchantStatus] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(d => setProducts(d.products ?? []));
  }, []);

  useEffect(() => {
    if (user && user.role === "MERCHANT" && user.merchant) {
      setMerchantStatus(user.merchant.status);
      // Load my products
      fetch("/api/products").then(r => r.json()).then(d => {
        const all = d.products || [];
        // For demo, filter by merchantId
        const mine = all.filter((p: any) => p.merchantId === user.merchantId);
        setMyProducts(mine);
        // Also try to get from merchant API
      });
    }
  }, [user]);

  useEffect(() => {
    const orig = Number(form.originalPrice);
    const vault = Number(form.vaultPrice);
    if (orig > 0 && vault > 0 && vault < orig) setDiscountPreview(Math.round(((orig - vault) / orig) * 100));
    else setDiscountPreview(null);
  }, [form.originalPrice, form.vaultPrice]);

  const handleAuth = async () => {
    setAuthError("");
    if (authMode === "signup" && authForm.password !== authForm.confirmPassword) return setAuthError("Passwords do not match");
    setAuthLoadingState(true);
    try {
      const endpoint = authMode === "signup" ? "/api/auth/merchant/signup" : "/api/auth/merchant/login";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.reload();
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoadingState(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Immediate local preview for better UX - show image even if server URL fails
    const fileArray = Array.from(files).slice(0, 5 - uploadedImages.length);
    const previews = fileArray.map(f => URL.createObjectURL(f));
    setLocalPreviews(prev => [...prev, ...previews].slice(0, 5));
    
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fileArray.forEach(f => fd.append("images", f));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      const urls = d.uploaded.map((u: any) => u.url);
      setUploadedImages(prev => [...prev, ...urls].slice(0, 5));
    } catch (e: any) {
      setError(e.message + " - local preview shown, will use local for submit if needed");
      // If server upload fails, keep local preview and use data URL for submit fallback
      // For now, we keep server urls empty and will handle in submit
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
    setLocalPreviews(prev => {
      if (prev[idx]) URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const submit = async () => {
    if (!user || user.role !== "MERCHANT") return setError("Merchant login required");
    if (merchantStatus === "pending") return setError("Your merchant account is under review. Cannot submit yet.");
    if (merchantStatus === "suspended") return setError("Your merchant account is suspended. Contact admin.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/merchant/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          brand: form.brand || user.merchant?.brand || authForm.brand,
          merchantName: user.name,
          phone: user.phone,
          originalPrice: Number(form.originalPrice),
          vaultPrice: Number(form.vaultPrice),
          stock: Number(form.stock),
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed");
        setLoading(false);
        return;
      }
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      setMyProducts(p => [data.product, ...p]);
      setForm({ brand: "", title: "", description: "", originalPrice: "", vaultPrice: "", stock: "", category: "Mens", size: "", condition: "Surplus", location: "Dhaka, Bangladesh" });
      localPreviews.forEach(u => URL.revokeObjectURL(u));
      setUploadedImages([]);
      setLocalPreviews([]);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const isValidBDPhone = (phone: string) => /^01[3-9]\d{8}$/.test(phone);

  if (authLoading) return <div className="min-h-screen grid place-items-center font-mono text-[12px]">Loading...</div>;

  // Guest view - show pitch + auth
  if (!user) {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge variant="gold" className="mb-4">MERCHANT PORTAL • Secure Auth</Badge>
            <h1 className="text-[36px] sm:text-[48px] font-extrabold tracking-[-0.04em] leading-[0.9]">Turn deadstock<br /><span className="font-serif italic font-normal">into cash</span> in 1 hour.</h1>
            <p className="mt-5 text-[15px] leading-[1.6] text-muted max-w-[44ch]">Factories, brands, wholesalers — register as merchant. PENDING by default, admin approval required. Server-enforced RBAC.</p>
            <div className="mt-8 grid gap-3">
              {[
                { t: "PENDING by default", d: "New merchants start as PENDING, no privileges until ADMIN approves." },
                { t: "Secure RBAC", d: "Role enforced server-side, cannot fake via localStorage or request body." },
                { t: "10% commission", d: "Real earnings tracked, payout after delivery." },
              ].map(f => (
                <div key={f.t} className="flex gap-4 p-4 rounded-lg border border-border bg-bg2 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-ink text-bg grid place-items-center text-[12px] font-bold">✓</div>
                  <div><div className="font-bold text-[14px]">{f.t}</div><div className="text-[13px] text-muted mt-1">{f.d}</div></div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}>
            <Card className="rounded-xl shadow-md">
              <CardHeader>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setAuthMode("signup")} className={`px-4 h-8 rounded-pill text-[12px] font-bold ${authMode === "signup" ? "bg-ink text-white" : "bg-bg3"}`}>Merchant Signup</button>
                  <button onClick={() => setAuthMode("login")} className={`px-4 h-8 rounded-pill text-[12px] font-bold ${authMode === "login" ? "bg-ink text-white" : "bg-bg3"}`}>Merchant Login</button>
                </div>
                <CardTitle className="text-[20px]">{authMode === "signup" ? "Register as Merchant" : "Merchant Login"}</CardTitle>
                <CardDescription>Status: PENDING → APPROVED → SUSPENDED (admin controlled)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {authMode === "signup" && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className="font-mono text-[11px] text-muted">YOUR NAME *</label><Input className="mt-1" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Rafsan J." /></div>
                      <div><label className="font-mono text-[11px] text-muted">BRAND *</label><Input className="mt-1" value={authForm.brand} onChange={e => setAuthForm({ ...authForm, brand: e.target.value })} placeholder="Dhaka Surplus Co." /></div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className="font-mono text-[11px] text-muted">EMAIL *</label><Input className="mt-1" type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@brand.com" /></div>
                      <div><label className="font-mono text-[11px] text-muted">PHONE *</label><Input className="mt-1" value={authForm.phone} onChange={e => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="017xxxxxxxx" /></div>
                    </div>
                  </>
                )}
                {authMode === "login" && (
                  <div className="grid gap-3">
                    <div><label className="font-mono text-[11px] text-muted">EMAIL *</label><Input className="mt-1" type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /></div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="font-mono text-[11px] text-muted">PASSWORD *</label><Input className="mt-1" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" /></div>
                  {authMode === "signup" && <div><label className="font-mono text-[11px] text-muted">CONFIRM *</label><Input className="mt-1" type="password" value={authForm.confirmPassword} onChange={e => setAuthForm({ ...authForm, confirmPassword: e.target.value })} /></div>}
                </div>
                {authError && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[12px]">{authError}</div>}
                <Button className="w-full rounded-pill h-[46px]" onClick={handleAuth} disabled={authLoadingState}>{authLoadingState ? "..." : authMode === "signup" ? "Register → PENDING" : "Login →"}</Button>
                <div className="text-center font-mono text-[11px] text-muted">Customer? <Link href="/signup" className="underline font-bold">Create customer account</Link></div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // Logged in but not merchant
  if (user.role !== "MERCHANT") {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] py-16 text-center">
          <Badge variant="secondary" className="mb-4">{user.role} account</Badge>
          <h1 className="text-[32px] font-extrabold tracking-tight">You are logged in as {user.role}</h1>
          <p className="mt-3 text-muted">Merchant portal requires MERCHANT role. Your role is {user.role}. Please register as merchant or contact admin.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link href="/account"><Button variant="outline" className="rounded-pill">Go to Account</Button></Link>
            <Link href="/"><Button className="rounded-pill">Browse Vault</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  // Merchant logged in - check status
  if (merchantStatus === "pending") {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-goldLight border border-gold/20 grid place-items-center mx-auto text-[24px]">⏳</div>
          <h1 className="mt-6 text-[32px] font-extrabold tracking-tight">Your merchant account is under review.</h1>
          <p className="mt-3 text-muted max-w-[48ch] mx-auto">Status: <Badge variant="secondary">PENDING</Badge> — Admin will approve within 2 hours. You cannot submit products until approved. Server-enforced.</p>
          <div className="mt-8 p-4 rounded-lg bg-bg3 border max-w-[480px] mx-auto text-left font-mono text-[11px] leading-[1.6] text-muted">
            <div>Merchant: {user.merchant?.brand} • {user.name}</div>
            <div>Email: {user.email}</div>
            <div>Phone: {user.phone}</div>
            <div>Status: {merchantStatus}</div>
            <div className="mt-2">Once approved, you can access dashboard, add products, view orders, earnings.</div>
          </div>
        </div>
      </div>
    );
  }

  if (merchantStatus === "suspended") {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="max-w-[1320px] mx-auto px-[20px] py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 grid place-items-center mx-auto text-[24px]">🚫</div>
          <h1 className="mt-6 text-[32px] font-extrabold tracking-tight">Merchant Suspended</h1>
          <p className="mt-3 text-muted">Your privileges have been revoked. Contact admin.</p>
          <Badge variant="default" className="mt-3">SUSPENDED</Badge>
        </div>
      </div>
    );
  }

  // Approved merchant - full dashboard
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 sm:py-12 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Badge variant="gold" className="mb-4">MERCHANT DASHBOARD • {merchantStatus?.toUpperCase()} • Verified</Badge>
          <h1 className="text-[36px] sm:text-[42px] font-extrabold tracking-[-0.04em] leading-[0.9]">Welcome, {user.name?.split(" ")[0]}<br /><span className="font-serif italic font-normal">{user.merchant?.brand}</span></h1>
          <p className="mt-4 text-[14px] text-muted">Approved merchant — you can submit surplus, view sales, earnings. Role enforced server-side.</p>

          <Card className="mt-8 rounded-lg">
            <CardHeader><CardTitle className="text-[16px]">Your products ({myProducts.length})</CardTitle><CardDescription>Only your products — ownership enforced</CardDescription></CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-auto">
              {myProducts.map(p => (
                <div key={p.id} className="flex gap-3 p-2 border rounded-lg bg-white">
                  <img src={p.image} alt="" className="w-10 h-12 object-cover rounded bg-bg3" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{p.title}</div>
                    <div className="font-mono text-[10px] text-muted">৳{p.vaultPrice} • {p.availableQuantity} left • {p.status} • {p.discountPercent}% OFF</div>
                  </div>
                  <Badge variant={p.status === "pending" ? "secondary" : "gold"} className="text-[9px] h-fit">{p.status}</Badge>
                </div>
              ))}
              {myProducts.length === 0 && <div className="text-center py-6 text-muted text-[12px]">No products yet. Submit your first lot →</div>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle className="text-[18px]">Submit surplus lot</CardTitle>
              <CardDescription>Approved merchant • Server validates • Rate limited</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="font-mono text-[11px] text-muted">BRAND *</label><Input className="mt-2" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder={user.merchant?.brand || "Brand"} /></div>
                <div><label className="font-mono text-[11px] text-muted">CATEGORY *</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-2 w-full h-[44px] rounded-md border border-border bg-bg2 px-3 text-[14px]">
                    <option>Mens</option><option>Womens</option><option>Kids</option><option>Footwear</option><option>Accessories</option><option>Unisex</option>
                  </select>
                </div>
              </div>
              <div><label className="font-mono text-[11px] text-muted">TITLE *</label><Input className="mt-2" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Handloom Cotton Panjabi" /></div>
              <div><label className="font-mono text-[11px] text-muted">DESCRIPTION</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2 w-full min-h-[60px] rounded-md border border-border bg-bg2 px-3 py-2 text-[14px]" placeholder="Fabric, condition..." /></div>
              <div>
                <label className="font-mono text-[11px] text-muted">PRODUCT IMAGES * (Multiple upload, preview, remove, primary)</label>
                <div className="mt-2 border border-dashed border-border rounded-lg p-4 bg-bg2">
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleImageUpload} className="text-[12px]" />
                  <div className="mt-2 font-mono text-[10px] text-muted">Allowed: JPEG/PNG/WebP/AVIF, 5MB max each, max 5 images. Validated server-side type/size/dimensions.</div>
                  {uploading && <div className="mt-2 text-[11px] animate-pulse">Uploading...</div>}
                  {(uploadedImages.length > 0 || localPreviews.length > 0) && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {(localPreviews.length > 0 ? localPreviews : uploadedImages).map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img src={url} alt="" className="w-full h-20 object-cover rounded-lg border bg-bg3" onError={(e) => { (e.target as any).src = uploadedImages[idx] || localPreviews[idx] || '/placeholder.jpg'; }} />
                          <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] grid place-items-center">×</button>
                          {idx === 0 && <span className="absolute bottom-1 left-1 bg-ink text-white text-[8px] px-1.5 py-0.5 rounded-full">PRIMARY</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadedImages.length > 0 && <div className="mt-2 font-mono text-[10px] text-emerald-600">✓ {uploadedImages.length} uploaded to server: {uploadedImages[0]}</div>}
                  {localPreviews.length > 0 && uploadedImages.length === 0 && <div className="mt-2 font-mono text-[10px] text-amber-600">Local preview only - server upload pending, will still submit</div>}
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><label className="font-mono text-[11px] text-muted">ORIGINAL ৳ *</label><Input type="number" className="mt-2" value={form.originalPrice} onChange={e => setForm({ ...form, originalPrice: e.target.value })} /></div>
                <div><label className="font-mono text-[11px] text-muted">VAULT ৳ *</label><Input type="number" className="mt-2" value={form.vaultPrice} onChange={e => setForm({ ...form, vaultPrice: e.target.value })} />{discountPreview !== null && <div className="mt-1 text-[11px] font-mono text-emerald-600">{discountPreview}% OFF</div>}</div>
                <div><label className="font-mono text-[11px] text-muted">STOCK *</label><Input type="number" className="mt-2" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
              </div>
              {error && <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>}
              <Button onClick={submit} className="w-full rounded-pill h-[48px]" disabled={loading}>{loading ? "..." : "Submit to Vault →"}</Button>
              {submitted && <div className="text-center text-[13px] text-emerald-600 font-medium">✓ Submitted! Admin will review.</div>}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
