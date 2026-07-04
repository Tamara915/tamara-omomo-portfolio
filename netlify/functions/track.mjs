import { getStore } from "@netlify/blobs";

const MAX_LABEL = 120;
const MAX_PATH = 200;

function clean(s, max) {
  if (typeof s !== "string") return "";
  return s.slice(0, max);
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const type = body.type === "click" ? "click" : "pageview";
  const path = clean(body.path, MAX_PATH) || "/";
  const label = clean(body.label, MAX_LABEL);

  let refHost = "";
  if (typeof body.ref === "string" && body.ref) {
    try {
      refHost = new URL(body.ref).hostname.replace(/^www\./, "");
    } catch {
      /* ignore malformed referrer */
    }
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  const store = getStore("analytics");
  await store.setJSON(`evt/${dateStr}/${id}.json`, {
    ts: now.toISOString(),
    type,
    path,
    label,
    ref: refHost,
  });

  return new Response(null, { status: 204 });
};
