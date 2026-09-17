const UPSTREAM = "https://api.typesafe.ai/v1/systemone";

function allowOrigin(origin, env) {
  const list = String(env.ALLOW_ORIGIN || "https://4anti.github.io")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin) return false;
  return list.some((base) => origin === base || origin.startsWith(base + "/"));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {})
    }
  });
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const ok = allowOrigin(origin, env);
    if (req.method === "OPTIONS") {
      if (!ok) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
    if (path === "/config" && req.method === "GET") {
      if (!ok) return json({ error: { message: "Origin not allowed." } }, 403, origin);
      return json({ hasEnvKey: true, modelDefault: "jev-latest" }, 200, origin);
    }
    if (path !== "/v1/systemone" || req.method !== "POST") {
      return json({ error: { message: "Not Found" } }, 404, ok ? origin : "");
    }
    if (!ok) return json({ error: { message: "Origin not allowed." } }, 403, origin);
    const key = (env.TYPESAFE_API_KEY || "").trim();
    if (!key) return json({ error: { message: "Proxy has no TypeSafe key." } }, 500, origin);
    const body = await req.arrayBuffer();
    if (body.byteLength > 2_000_000) {
      return json({ error: { message: "Request body too large." } }, 413, origin);
    }
    const up = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body
    });
    const text = await up.text();
    return new Response(text, {
      status: up.status,
      headers: {
        "Content-Type": up.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders(origin)
      }
    });
  }
};
