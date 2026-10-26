import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How FlashVault BD collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="What we collect, why we collect it, and the control you have over it. Written in plain language — no surprises."
    >
      <LegalSection h="1. What we collect">
        <p><strong>Account information:</strong> your name, email address, and phone number when you create an account.</p>
        <p><strong>Order information:</strong> the delivery name, phone number, full address, and city you enter at checkout, plus the items you order.</p>
        <p><strong>Usage information:</strong> basic technical data such as pages visited and an anonymous viewer identifier used to show the live viewer count.</p>
        <p>We do not collect payment card numbers — orders are Cash on Delivery (COD).</p>
      </LegalSection>

      <LegalSection h="2. Why we collect it">
        <p>To create and secure your account, to deliver your orders to the right address via courier, to send you order-related and account-security emails (verification, login alerts), and to understand how the site is used so we can improve it.</p>
        <p>We never sell your personal information to anyone.</p>
      </LegalSection>

      <LegalSection h="3. Cookies &amp; local storage">
        <p>We use a small number of cookies and browser storage entries: a login session cookie (<code>fv_token</code>), your cart contents, your language preference, an anonymous viewer id for the live viewer count, and your wishlist. You can clear these at any time from your browser settings — only the login session is required for account features.</p>
        <p>If we run advertising (for example Facebook ads), the advertising platform may set its own cookies subject to its own policy.</p>
      </LegalSection>

      <LegalSection h="4. Who can see your data">
        <p>Your data is stored with our hosting and database providers strictly to operate the service, and your delivery details are shared with the courier company only to complete your delivery. Merchants on FlashVault see the order details needed to pack and ship your item — not your account password.</p>
        <p>Passwords are stored only as salted hashes. We never see or store your plaintext password.</p>
      </LegalSection>

      <LegalSection h="5. How long we keep it">
        <p>Account data is kept while your account is active. Order records are retained as long as needed for accounting and dispute resolution. You can request deletion of your account and personal data at any time (see Contact).</p>
      </LegalSection>

      <LegalSection h="6. Your rights">
        <p>You can ask us to show, correct, or delete your personal information, or export your order history. Message or email us with the account email and we will respond within a reasonable time.</p>
      </LegalSection>

      <LegalSection h="7. Security">
        <p>We use industry-standard measures: hashed passwords, brute-force lockout on repeated failed logins, login alert emails, HTTPS in transit, and admin access controls. No online service can guarantee absolute security, but we work to protect your data seriously.</p>
      </LegalSection>

      <LegalSection h="8. Changes">
        <p>If we change this policy, we will update the date at the bottom of this page. Material changes will be announced on the site.</p>
      </LegalSection>

      <LegalSection h="9. Contact">
        <p>Questions about privacy? Reach us via our <Link href="/contact" className="underline">contact page</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
