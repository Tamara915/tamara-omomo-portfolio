import { getStore } from "@netlify/blobs";

function dateStrDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function topN(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
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

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "ADMIN_PASSWORD is not set on the server. Add it in Netlify site settings > Environment variables, then redeploy." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  if (body.password !== expected) {
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const days = Math.min(Math.max(parseInt(body.days, 10) || 30, 1), 90);
  const store = getStore("analytics");

  const perDay = [];
  const pageviewsByPath = {};
  const clicksByLabel = {};
  const refCounts = {};
  let totalPageviews = 0;
  let totalClicks = 0;

  for (let i = days - 1; i >= 0; i--) {
    const dateStr = dateStrDaysAgo(i);
    const { blobs } = await store.list({ prefix: `evt/${dateStr}/` });
    let dayPageviews = 0;
    let dayClicks = 0;

    for (const b of blobs) {
      const evt = await store.get(b.key, { type: "json" });
      if (!evt) continue;
      if (evt.type === "click") {
        dayClicks++;
        totalClicks++;
        const label = evt.label || "(unlabeled)";
        clicksByLabel[label] = (clicksByLabel[label] || 0) + 1;
      } else {
        dayPageviews++;
        totalPageviews++;
        const path = evt.path || "/";
        pageviewsByPath[path] = (pageviewsByPath[path] || 0) + 1;
      }
      if (evt.ref) refCounts[evt.ref] = (refCounts[evt.ref] || 0) + 1;
    }
    perDay.push({ date: dateStr, pageviews: dayPageviews, clicks: dayClicks });
  }

  return new Response(
    JSON.stringify({
      days,
      totalPageviews,
      totalClicks,
      perDay,
      topPages: topN(pageviewsByPath),
      topClicks: topN(clicksByLabel),
      topReferrers: topN(refCounts),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
