"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";

function VerifyContent() {
  const params = useSearchParams();
  const status = params.get("status");
  const [title, setTitle] = useState("Verifying your email…");
  const [msg, setMsg] = useState("One moment.");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "ok") { setOk(true); setTitle("✓ Email verified!"); setMsg("Your account is now secured. You're all set for Friday 9PM drops."); }
    else if (status === "invalid") { setOk(false); setTitle("Invalid link"); setMsg("This verification link is not valid. Request a new one from your account page."); }
    else if (status === "expired") { setOk(false); setTitle("Link expired"); setMsg("Verification links expire after 24 hours. Request a new one from your account page."); }
    else if (status === "rate") { setOk(false); setTitle("Too many attempts"); setMsg("Please wait a minute and try again."); }
    else if (status === "error") { setOk(false); setTitle("Something went wrong"); setMsg("Please try again later or contact support."); }
  }, [status]);

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <div className="max-w-[520px] mx-auto px-5 py-24 text-center">
        <div className={`w-16 h-16 rounded-full grid place-items-center mx-auto text-[26px] border ${ok === true ? "bg-emerald-50 border-emerald-200 text-emerald-600" : ok === false ? "bg-red-50 border-red-200 text-red-600" : "bg-bg3 border-border text-muted animate-pulse"}`}>
          {ok === true ? "✓" : ok === false ? "!" : "…"}
        </div>
        <h1 className="mt-6 text-[28px] font-extrabold tracking-[-0.03em]">{title}</h1>
        <p className="mt-3 text-muted text-[14px] leading-[1.6]">{msg}</p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href="/account"><Button className="rounded-pill">Go to My Account →</Button></Link>
          <Link href="/"><Button variant="outline" className="rounded-pill">Back to Vault</Button></Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center font-mono text-[13px]">Loading…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
