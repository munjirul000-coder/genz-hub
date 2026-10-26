import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Reach the FlashVault BD team — orders, returns, merchant partnerships.",
};

export default function ContactPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

  return (
    <LegalPage
      title="Contact Us"
      subtitle="Order issue, return request, or merchant partnership — we usually reply within 24 hours."
    >
      <LegalSection h="Support">
        {supportEmail ? (
          <p>
            📧 Email: <a href={`mailto:${supportEmail}`} className="underline font-semibold">{supportEmail}</a>
          </p>
        ) : (
          <p>The fastest way to reach us is the Facebook page or Instagram profile where you discovered FlashVault — send a message there and we will respond.</p>
        )}
        <p>For order issues, always include your <strong>Order ID</strong> (in your order confirmation) so we can find it instantly.</p>
      </LegalSection>

      <LegalSection h="What to contact about">
        <ul className="list-disc pl-5 space-y-1">
          <li>Order status, delivery questions, address changes (before dispatch)</li>
          <li>Returns &amp; refunds — see the <Link href="/refund" className="underline">Refund Policy</Link> first</li>
          <li>Merchant / brand partnership — sell your surplus stock on FlashVault via the <Link href="/merchant" className="underline">Merchant page</Link></li>
          <li>Account &amp; login problems</li>
        </ul>
      </LegalSection>

      <LegalSection h="Response time">
        <p>We aim to reply within 24 hours (9 AM – 10 PM, Asia/Dhaka). During Friday drops things are busy — order issues always get priority.</p>
      </LegalSection>

      <LegalSection h="Business">
        <p>FlashVault BD • Dhaka, Bangladesh</p>
      </LegalSection>
    </LegalPage>
  );
}
