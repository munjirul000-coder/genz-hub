import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "About FlashVault",
  description: "FlashVault BD — real surplus stock from top Bangladeshi brands, in 1-hour Friday drops.",
};

export default function AboutPage() {
  return (
    <LegalPage
      title="Surplus, not waste."
      subtitle="FlashVault BD is a 1-hour flash drop platform for surplus and dead-stock clothing from Bangladesh's loved brands."
    >
      <LegalSection h="The idea">
        <p>Every season, top Bangladeshi brands end up with surplus and dead-stock pieces — real, original clothing that never found a shelf. FlashVault gives that stock one more life: one hour, real discounts up to 80% off, and nothing fake about it.</p>
      </LegalSection>

      <LegalSection h="How it works">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Friday 9 PM (Asia/Dhaka)</strong> — the vault opens for 1 hour.</li>
          <li><strong>Real inventory</strong> — every piece listed actually exists; stock counts are server-enforced, and an order locks your piece.</li>
          <li><strong>Real discounts</strong> — original price vs vault price is shown on every item, with the discount calculated by the server, not marketing.</li>
          <li><strong>Cash on Delivery</strong> — pay when your parcel arrives. Dhaka ৳80, outside ৳120.</li>
        </ul>
      </LegalSection>

      <LegalSection h="For brands & merchants">
        <p>Verified brands can list their surplus on FlashVault through the <Link href="/merchant" className="underline">Merchant page</Link>. Every listing is reviewed before it goes live — real photos, honest condition notes, honest prices.</p>
      </LegalSection>

      <LegalSection h="What we stand for">
        <p>No fake counters, no inflated &ldquo;was&rdquo; prices, no bots buying stock. The viewer count you see on the drop page is the real number of people with the page open. If we say 12 people are watching, there are 12.</p>
      </LegalSection>

      <LegalSection h="Where we are">
        <p>Based in Dhaka, Bangladesh, delivering nationwide via courier partners. Questions? <Link href="/contact" className="underline">Contact us</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
