import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using FlashVault BD — accounts, drops, orders, and Cash on Delivery.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="The agreement between you and FlashVault BD when you use this site, join a drop, or place an order."
    >
      <LegalSection h="1. About FlashVault">
        <p>FlashVault BD is an online platform that sells surplus and dead-stock clothing from verified Bangladeshi brands through limited-time &ldquo;flash drops&rdquo; — typically every Friday at 9:00 PM (Asia/Dhaka) for one hour, while stock lasts.</p>
      </LegalSection>

      <LegalSection h="2. Accounts">
        <p>You must provide accurate information (real name, working phone number) — couriers use it to deliver your order. You are responsible for keeping your password safe. We may suspend accounts used for fraud, abuse, or attempts to disrupt drops.</p>
      </LegalSection>

      <LegalSection h="3. How drops work">
        <p>Drop windows are enforced by the server: the vault opens at the scheduled time and closes when the hour ends or stock runs out, whichever comes first. Placing an order locks the inventory for a short time so the same piece cannot be sold twice. Stock is real and limited — first come, first served.</p>
        <p>All prices are in Bangladeshi Taka (BDT). Prices and availability may change between drops without notice.</p>
      </LegalSection>

      <LegalSection h="4. Orders &amp; payment">
        <p>Orders are <strong>Cash on Delivery (COD)</strong>. You pay the courier when your parcel arrives. The total shown at checkout includes the delivery charge (inside Dhaka ৳80, outside Dhaka ৳120).</p>
        <p>Repeated refusal of COD parcels after confirmation may lead to account suspension, since a refused parcel still costs shipping and blocks the item for other customers.</p>
      </LegalSection>

      <LegalSection h="5. Delivery">
        <p>Delivery is handled by third-party courier partners. Delivery time depends on your location and courier schedule. Delay or failure caused by incorrect address or unreachable phone numbers is outside our responsibility — please double-check your address at checkout.</p>
      </LegalSection>

      <LegalSection h="6. Product condition &amp; merchant items">
        <p>Products are surplus/dead-stock items — each listing shows its condition and real photos. Items are described honestly; minor factory variations can occur with surplus stock. Returns follow our <Link href="/refund" className="underline">Refund &amp; Return Policy</Link>.</p>
      </LegalSection>

      <LegalSection h="7. Acceptable use">
        <p>Do not attempt to bypass the drop timer, scrape or overload the site, resell access, place fraudulent orders, or interfere with other customers. We actively monitor and block such activity.</p>
      </LegalSection>

      <LegalSection h="8. Liability">
        <p>FlashVault BD&rsquo;s liability for any claim relating to an order is limited to the amount paid for that order. We are not liable for indirect losses. Nothing here limits your legal rights as a consumer under Bangladeshi law.</p>
      </LegalSection>

      <LegalSection h="9. Changes">
        <p>We may update these terms; the date at the bottom shows the current version. Continuing to use the site after changes means you accept them.</p>
      </LegalSection>

      <LegalSection h="10. Governing law">
        <p>These terms are governed by the laws of Bangladesh, with courts of Dhaka having jurisdiction.</p>
      </LegalSection>
    </LegalPage>
  );
}
