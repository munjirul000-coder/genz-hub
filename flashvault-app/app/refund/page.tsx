import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund & Return Policy",
  description: "FlashVault BD refund, return, and exchange rules for damaged or wrong items.",
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund & Return Policy"
      subtitle="Simple and fair: check your parcel at delivery, and if something is wrong, we make it right."
    >
      <LegalSection h="1. Check at delivery">
        <p>When the courier hands over your parcel, please check the item — right product, right size, and condition. Since payment is Cash on Delivery, you can refuse the parcel at the door if it is clearly the wrong item or visibly damaged.</p>
      </LegalSection>

      <LegalSection h="2. 7-day return window">
        <p>If you discover a problem after accepting delivery — wrong item, damaged/defective item, or a missing piece — you can request a return within <strong>7 days of delivery</strong>.</p>
        <p>To make claims smooth, we recommend recording a short unboxing video. It protects you and speeds up approval.</p>
      </LegalSection>

      <LegalSection h="3. What qualifies">
        <ul className="list-disc pl-5 space-y-1">
          <li>Wrong item, wrong size, or wrong color compared to your order.</li>
          <li>Item damaged in transit or defective (stitching, zippers, stains not shown in listing).</li>
          <li>Missing pieces from the order.</li>
        </ul>
      </LegalSection>

      <LegalSection h="4. What does not qualify">
        <ul className="list-disc pl-5 space-y-1">
          <li>Items worn, washed, or damaged after delivery.</li>
          <li>Minor surplus variations clearly disclosed in the listing (condition, factory finish).</li>
          <li>Change of mind on an item that matches its listing exactly — but message us anyway; if stock allows, we will try to arrange an exchange.</li>
        </ul>
      </LegalSection>

      <LegalSection h="5. How to request">
        <p>Message us via the <Link href="/contact" className="underline">contact page</Link> with your order ID (shown on your order confirmation), a photo or video of the issue, and a short description. We will respond and arrange courier pick-up for approved returns.</p>
      </LegalSection>

      <LegalSection h="6. Refunds">
        <p>Once a return is approved and received, refunds are issued within <strong>7 working days</strong> via mobile financial services (bKash/Nagad) or the method you prefer. Since payment is COD, nothing is deducted automatically — we return what you paid, including delivery charge if the error was ours.</p>
      </LegalSection>

      <LegalSection h="7. Exchanges">
        <p>Size or color exchanges are subject to available stock — surplus items are often one-of-a-kind, so exchanges are first come, first served.</p>
      </LegalSection>
    </LegalPage>
  );
}
