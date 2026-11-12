// PayPal layer. Demo mode generates ids locally; sandbox mode calls
// https://api-m.sandbox.paypal.com (Orders v2, Payouts v1) with fetch only.

import type { Mode } from "./types";

const API_BASE = "https://api-m.sandbox.paypal.com";

export class PaypalError extends Error {
  status = 502;
}

export function paypalMode(): Mode {
  return process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
    ? "sandbox"
    : "demo";
}

export function demoId(prefix: "DEMO-ORDER" | "DEMO-BATCH"): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** 1234 -> "12.34", the string format PayPal expects. */
export function centsToValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

// OAuth token, kept until shortly before it expires.
const tokenCache = globalThis as unknown as {
  __paypalToken?: { value: string; expiresAt: number };
};

async function accessToken(): Promise<string> {
  const cached = tokenCache.__paypalToken;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const credentials = btoa(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  );
  const body = await send("/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  tokenCache.__paypalToken = {
    value: body.access_token,
    // Refresh a minute early so a token never expires mid-request.
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  return body.access_token;
}

/** Sends a request and returns parsed JSON, or throws PaypalError with PayPal's own message. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function send(path: string, init: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new PaypalError(`Could not reach PayPal: ${(e as Error).message}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PaypalError(describeError(res.status, body));
  return body;
}

function describeError(
  status: number,
  body: {
    message?: string;
    error_description?: string;
    details?: { issue?: string; description?: string }[];
  },
): string {
  const main = body.message ?? body.error_description ?? `HTTP ${status}`;
  const detail = body.details?.[0];
  const extra = detail
    ? ` (${[detail.issue, detail.description].filter(Boolean).join(": ")})`
    : "";
  return `PayPal error ${status}: ${main}${extra}`;
}

async function api(path: string, payload: unknown, requestId: string) {
  return send(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      // Makes retries of the same request safe on PayPal's side.
      "PayPal-Request-Id": requestId,
    },
    body: JSON.stringify(payload),
  });
}

/** Creates an Orders v2 order and returns its id and the buyer approval link. */
export async function createOrder(input: {
  amountCents: number;
  description: string;
  referenceId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ orderId: string; approveUrl: string }> {
  const order = await api(
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: input.description.slice(0, 127),
          amount: { currency_code: "USD", value: centsToValue(input.amountCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "SunShare",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    },
    `order-${input.referenceId}`,
  );
  const link = (order.links as { rel: string; href: string }[] | undefined)?.find(
    (l) => l.rel === "payer-action" || l.rel === "approve",
  );
  if (!link) throw new PaypalError("PayPal did not return an approval link.");
  return { orderId: order.id, approveUrl: link.href };
}

/** Captures an approved order. Capturing an already-captured order counts as success. */
export async function captureOrder(orderId: string): Promise<void> {
  try {
    const result = await api(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {},
      `capture-${orderId}`,
    );
    if (result.status !== "COMPLETED") {
      throw new PaypalError(`PayPal order is ${result.status}, not COMPLETED.`);
    }
  } catch (e) {
    if (e instanceof PaypalError && e.message.includes("ORDER_ALREADY_CAPTURED")) return;
    throw e;
  }
}

/** Sends one Payouts v1 batch with one item per owner. Returns PayPal's batch id. */
export async function sendPayoutBatch(input: {
  senderBatchId: string;
  subject: string;
  note: string;
  items: { email: string; amountCents: number; itemId: string }[];
}): Promise<string> {
  const result = await api(
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        email_subject: input.subject,
        email_message: input.note,
      },
      items: input.items.map((item) => ({
        recipient_type: "EMAIL",
        receiver: item.email,
        amount: { value: centsToValue(item.amountCents), currency: "USD" },
        note: input.note,
        sender_item_id: item.itemId,
      })),
    },
    input.senderBatchId,
  );
  return result.batch_header.payout_batch_id;
}
