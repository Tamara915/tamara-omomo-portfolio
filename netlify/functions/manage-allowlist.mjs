import { getStore } from "@netlify/blobs";

function isValidEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
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

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "ADMIN_PASSWORD is not set on the server." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (body.password !== expected) {
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore("access");
  const key = "allowlist.json";
  let allowlist = (await store.get(key, { type: "json" })) || [];
  if (!Array.isArray(allowlist)) allowlist = [];

  const action = body.action;

  if (action === "add") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!allowlist.includes(email)) {
      allowlist.push(email);
      await store.setJSON(key, allowlist);
    }
  } else if (action === "remove") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    allowlist = allowlist.filter((e) => e !== email);
    await store.setJSON(key, allowlist);
  } else if (action !== "list") {
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, allowlist }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
