const LOGIN_PATH = "/case-study-login.html";

function fromBase64Url(b64url) {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

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

function getCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expectedSig = await hmacSign(payload, secret);
  if (expectedSig !== sig) return null;
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }
  if (!data.email || !data.exp || data.exp < Date.now()) return null;
  return data;
}

export default async (request, context) => {
  const secret = Deno.env.get("AUTH_SECRET");
  if (!secret) {
    // Fail closed: without a secret we cannot verify sessions, so don't serve
    // the gated page.
    return Response.redirect(new URL(LOGIN_PATH, request.url), 302);
  }

  const token = getCookie(request, "cs_session");
  const session = await verifySession(token, secret);

  if (!session) {
    return Response.redirect(new URL(LOGIN_PATH, request.url), 302);
  }

  return context.next();
};
