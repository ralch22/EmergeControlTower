/**
 * Email delivery via Resend's HTTP API (no SDK dependency — plain fetch, so
 * it runs unchanged inside the CF Container).
 *
 * This is the v1 delivery fallback: when a client has no connected social
 * account, an approved asset is emailed to their deliveryEmail. Fits J Pools'
 * first-month reality and keeps "Approve" from being a dead end.
 *
 * Requires RESEND_API_KEY. From address is RESEND_FROM or a sensible default.
 */
export interface DeliveryResult {
  delivered: "email" | "none";
  reason?: string;
  id?: string;
}

interface DeliverArgs {
  to: string;
  clientName: string;
  title: string;
  body: string;
  assetUrl?: string;
}

export async function deliverByEmail(args: DeliverArgs): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { delivered: "none", reason: "RESEND_API_KEY not configured" };
  }
  if (!args.to) {
    return { delivered: "none", reason: "client has no deliveryEmail set" };
  }

  const from = process.env.RESEND_FROM || "Emerge Studio <studio@emergedigital.com>";
  const html = renderEmail(args);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `Your content is ready: ${args.title}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { delivered: "none", reason: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { delivered: "email", id: data.id };
  } catch (err) {
    return { delivered: "none", reason: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderEmail({ clientName, title, body, assetUrl }: DeliverArgs): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px;">
    <h1 style="font-size:18px;color:#fff;margin:0 0 4px;">${escapeHtml(title)}</h1>
    <p style="font-size:13px;color:#a1a1aa;margin:0 0 20px;">Approved content for ${escapeHtml(clientName)}</p>
    ${assetUrl ? `<p><a href="${escapeHtml(assetUrl)}" style="display:inline-block;background:#06b6d4;color:#0a0a0a;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">View asset</a></p>` : ""}
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#d4d4d8;border-top:1px solid #27272a;padding-top:18px;margin-top:18px;">${escapeHtml(body)}</div>
    <p style="font-size:11px;color:#52525b;margin-top:24px;">Delivered by Emerge Content Studio</p>
  </div>
</body></html>`;
}
