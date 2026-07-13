import { getStore } from "@netlify/blobs";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function isValidEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function siteOrigin(req) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function sendMagicLinkEmail({ to, link }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set on the server.");
  }
  const from = process.env.RESEND_FROM || "Tamara Omomo <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your case study access link",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <p>Here's your one-time link to view the case study:</p>
          <p><a href="${link}" style="display:inline-block; padding:12px 20px; background:#f87f23; color:#15100d; text-decoration:none; border-radius:8px; font-weight:600;">View case study</a></p>
          <p style="color:#888; font-size:13px;">This link expires in 15 minutes and can only be used once. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${text.slice(0, 300)}`);
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  // Generic response regardless of outcome — never reveal whether an email
  // is on the allowlist.
  const genericResponse = new Response(
    JSON.stringify({ ok: true, message: "If that email is approved, a link is on its way." }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

  if (!isValidEmail(email)) return genericResponse;

  const store = getStore("access");
  const allowlist = (await store.get("allowlist.json", { type: "json" })) || [];
  if (!Array.isArray(allowlist) || !allowlist.includes(email)) return genericResponse;

  const tokenId = crypto.randomUUID();
  await store.setJSON(`magic/${tokenId}.json`, {
    email,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  const link = `${siteOrigin(req)}/.netlify/functions/verify?token=${tokenId}`;

  try {
    await sendMagicLinkEmail({ to: email, link });
  } catch (e) {
    // Log server-side only — client still gets the generic response so we
    // don't leak allowlist membership or provider errors.
    console.error("sendMagicLinkEmail failed:", e.message);
  }

  return genericResponse;
};
