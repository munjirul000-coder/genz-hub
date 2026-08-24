'use strict';
/* Gen-Z Hub — payment architecture.

   IMPORTANT (honest by design): no payment gateway is wired up in this deployment, so nothing
   is ever silently marked "paid". Everything paid (job packages, ad campaigns, cosmetic items,
   marketplace card payments) creates a *pending* record and waits for a real provider callback.

   To enable real payments set these environment variables and implement the two marked spots:
     PAYMENT_PROVIDER   sslcommerz | bkash | stripe   (name of your provider)
     PAYMENT_KEY        API key / store id
     PAYMENT_SECRET     API secret / store password
     PAYMENT_SANDBOX    1 for sandbox, 0 for live
     PUBLIC_URL         https://your-domain (used for success/fail/IPN callbacks)

   Card data never touches Gen-Z Hub: the provider hosts the checkout page and we only store
   the provider's reference id and the confirmed status. */

const crypto = require('crypto');
const { db } = require('./db');
const U = require('./util');

const PROVIDER = process.env.PAYMENT_PROVIDER || '';
const KEY = process.env.PAYMENT_KEY || '';
const SECRET = process.env.PAYMENT_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

const NOT_CONFIGURED_MESSAGE =
  'Online payment is not enabled on this deployment yet. Cash on delivery is available, and the '
  + 'admin can enable a payment gateway from Admin → Settings.';

function isConfigured() { return !!(PROVIDER && KEY && SECRET); }

function status() {
  return {
    configured: isConfigured(),
    provider: PROVIDER || null,
    sandbox: process.env.PAYMENT_SANDBOX !== '0',
    message: isConfigured() ? 'Payment gateway configured.' : NOT_CONFIGURED_MESSAGE,
    required_env: ['PAYMENT_PROVIDER', 'PAYMENT_KEY', 'PAYMENT_SECRET', 'PUBLIC_URL'],
  };
}

/**
 * Create a payment intent. With a provider configured this is where you call the provider's
 * "create session" API and return its redirect URL. Without one we return an unpaid intent
 * plus a clear message — we never fake a success.
 */
function createIntent({ amount_cents, ref, userId, purpose = 'order' }) {
  const intent = {
    ref,
    purpose,
    amount_cents,
    amount: amount_cents / 100,
    currency: 'BDT',
    provider: PROVIDER || null,
    status: 'unconfigured',
    redirect_url: null,
    message: NOT_CONFIGURED_MESSAGE,
    token: crypto.randomBytes(12).toString('hex'),
  };
  if (!isConfigured()) return intent;

  // ---- INTEGRATION POINT ------------------------------------------------------------------
  // const session = await provider.createSession({ amount_cents, ref, success_url: `${PUBLIC_URL}/api/payments/return`, ... });
  // return { ...intent, status: 'created', redirect_url: session.url, message: 'Redirecting to payment…' };
  // -----------------------------------------------------------------------------------------
  return { ...intent, status: 'created', redirect_url: null, message: 'Payment session creation is not implemented for this provider yet.' };
}

/**
 * Verify a provider callback (IPN/webhook) and mark the referenced record paid.
 * Returns { ok, ref } — callers must never trust client-supplied "paid" flags.
 */
function confirmCallback(payload = {}) {
  if (!isConfigured()) return { ok: false, error: NOT_CONFIGURED_MESSAGE };
  // ---- INTEGRATION POINT: validate signature/hash with SECRET before trusting anything ----
  const verified = false;
  if (!verified) return { ok: false, error: 'Payment callback signature verification is not implemented.' };
  const ref = String(payload.ref || '');
  db.prepare("UPDATE orders SET payment_status='paid', updated_at=? WHERE code=?").run(U.now(), ref);
  db.prepare("UPDATE package_purchases SET payment_status='paid' WHERE payment_ref=?").run(ref);
  return { ok: true, ref };
}

module.exports = { isConfigured, status, createIntent, confirmCallback, NOT_CONFIGURED_MESSAGE, PROVIDER };
