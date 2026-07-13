import { getStore } from "@netlify/blobs";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const GATED_PATH = "/case-study-everphone.html";
const LOGIN_PATH = "/case-study-login.html";

function toBase64Url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

async function makeSessionToken(email, secret) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({
    email,
    exp: Date.now() + SESSION_TTL_MS,
  })));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export default async (req) => {
  const url = new URL(req.url);
  const tokenId = url.searchParams.get("token");
  const redirectTo = (path) => new Response(null, { status: 302, headers: { Location: path } });

  if (!tokenId) return redirectTo(`${LOGIN_PATH}?error=missing_token`);

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return new Response("AUTH_SECRET is not set on the server.", { status: 500 });
  }

  const store = getStore("access");
  const key = `magic/${tokenId}.json`;
  const record = await store.get(key, { type: "json" });

  if (!record || record.exp < Date.now()) {
    if (record) await store.delete(key);
    return redirectTo(`${LOGIN_PATH}?error=expired`);
  }

  // One-time use.
  await store.delete(key);

  const sessionToken = await makeSessionToken(record.email, secret);
  const cookie = [
    `cs_session=${sessionToken}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ].join("; ");

  return new Response(null, {
    status: 302,
    headers: {
      Location: GATED_PATH,
      "Set-Cookie": cookie,
    },
  });
};
