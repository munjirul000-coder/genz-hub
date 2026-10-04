"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import type { Product } from "@/lib/types";

const BD_PHONE = /^01[3-9]\d{8}$/;

type CheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  quantity: number;
  onSuccess?: (order: any) => void;
};

export function CheckoutModal({ open, onClose, product, quantity, onSuccess }: CheckoutModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Dhaka");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // Prefill from logged-in user + reset on open
  useEffect(() => {
    if (open) {
      setPlacedOrder(null);
      setServerError("");
      setErrors({});
      setName(user?.name || "");
      setPhone(user?.phone || "");
      setAddress("");
      setCity("Dhaka");
    }
  }, [open, user]);

  if (!product) return null;

  const isDhaka = city.trim().toLowerCase().includes("dhaka");
  const deliveryCharge = isDhaka ? 80 : 120;
  const subtotal = product.vaultPrice * quantity;
  const total = subtotal + deliveryCharge;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = "Full name required";
    if (!BD_PHONE.test(phone.trim())) e.phone = "Valid BD phone required (01XXXXXXXXX)";
    if (!address.trim() || address.trim().length < 10) e.address = "Full address required — house, road, area (min 10 chars)";
    if (!city.trim() || city.trim().length < 2) e.city = "City required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    if (!user) { setServerError("Login required to place order"); return; }
    setSubmitting(true);
    setServerError("");
    const idempotencyKey = `order_${product.id}_${user.id}_${Date.now()}`;
    try {
      const r = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          paymentMethod: "cod",
          idempotencyKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.code === "AUTH_REQUIRED") setServerError("Login required to place order — please sign in");
        else setServerError(d.error || "Order failed");
        return;
      }
      setPlacedOrder(d.order);
      onSuccess?.(d.order);
      setTimeout(() => onClose(), 3200);
    } catch (e: any) {
      setServerError(e.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, key: string, value: string, setValue: (v: string) => void, placeholder: string, opts?: { textarea?: boolean; inputMode?: string }) => (
    <div>
      <label className="font-mono text-[11px] text-muted">{label}</label>
      {opts?.textarea ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`mt-2 w-full rounded-md border bg-bg2 px-3 py-2.5 text-[14px] outline-none focus:border-ink transition ${errors[key] ? "border-red-300 bg-red-50/40" : "border-border"}`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          inputMode={opts?.inputMode as any}
          className={`mt-2 w-full h-[44px] rounded-md border bg-bg2 px-3 text-[14px] outline-none focus:border-ink transition ${errors[key] ? "border-red-300 bg-red-50/40" : "border-border"}`}
        />
      )}
      {errors[key] && <div className="mt-1.5 text-[11px] text-red-600 font-medium">{errors[key]}</div>}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-[16px] p-4 grid place-items-center overflow-y-auto" onClick={submitting ? undefined : onClose}>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="w-full max-w-[460px] bg-bg2 border border-border rounded-xl shadow-lg p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {!placedOrder ? (
              <>
                <h3 className="font-bold text-[18px]">Secure Checkout</h3>
                <p className="mt-1 text-[13px] text-muted">{product.title} × {quantity}</p>

                <div className="mt-5 space-y-4">
                  {field("FULL NAME *", "name", name, setName, "Your full name")}
                  {field("PHONE *", "phone", phone, setPhone, "01XXXXXXXXX", { inputMode: "numeric" })}
                  {field("FULL ADDRESS *", "address", address, setAddress, "House, Road, Area — complete delivery address", { textarea: true })}
                  {field("CITY *", "city", city, setCity, "Dhaka / Chattogram / Sylhet …")}
                </div>

                {/* Delivery charge — live */}
                <div className="mt-4 p-3 rounded-md bg-bg3 border border-border text-[11px] space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted">Subtotal ({quantity} × {formatBDT(product.vaultPrice)})</span><span>{formatBDT(subtotal)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted">Delivery — {isDhaka ? "Inside Dhaka" : "Outside Dhaka"}</span>
                    <span className="font-bold">{formatBDT(deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[13px] pt-1.5 border-t border-border">
                    <span>Total (Cash on Delivery)</span>
                    <span>{formatBDT(total)}</span>
                  </div>
                </div>

                {serverError && <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-[12px]">{serverError}</div>}

                <div className="mt-6 flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-pill" onClick={onClose} disabled={submitting}>Cancel</Button>
                  <Button className="flex-1 rounded-pill" disabled={submitting} onClick={submit}>
                    {submitting ? "Placing…" : `Confirm Order — ${formatBDT(total)}`}
                  </Button>
                </div>
                <p className="mt-3 text-center font-mono text-[10px] text-muted">Cash on Delivery • Real inventory lock • Order confirmed instantly</p>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white grid place-items-center mx-auto text-[20px]">✓</div>
                <h3 className="mt-4 font-bold text-[18px]">Order Confirmed! {placedOrder.id}</h3>
                <p className="mt-2 text-[13px] text-muted">Delivering to {placedOrder.city} • {formatBDT(placedOrder.deliveryFee)} delivery</p>
                <p className="mt-1 text-[13px] text-muted">Total paid on delivery: <strong>{formatBDT(placedOrder.totalAmount)}</strong></p>
                <p className="mt-2 font-mono text-[11px] text-muted">Tracking: {placedOrder.courierTracking} ({placedOrder.courierName})</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
