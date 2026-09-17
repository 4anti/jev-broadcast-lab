const UPSTREAM = "https://api.typesafe.ai/v1/systemone";
const COOKIE = "jev_site";
const SESSION_TTL = 3600;
// ponytail: per-isolate window; Cloudflare Access if abuse shows up
const HITS = new Map();

function allowOrigin(origin, env) {
  const list = String(env.ALLOW_ORIGIN || "https://4anti.github.io")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin) return false;
  return list.some((base) => origin === base || origin.startsWith(base + "/"));
}

function fromOurPage(req, origin, env) {
  if (!allowOrigin(origin, env)) return false;
  const site = req.headers.get("Sec-Fetch-Site") || "";
  const mode = req.headers.get("Sec-Fetch-Mode") || "";
  if (site !== "cross-site" && site !== "same-origin") return false;
  if (mode && mode !== "cors" && mode !== "same-origin") return false;
  return true;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

function json(body, status, origin, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
      ...(extra || {})
    }
  });
}

function limited(ip) {
  const now = Date.now();
  const row = HITS.get(ip) || { n: 0, t: now };
  if (now - row.t > 60_000) {
    row.n = 0;
    row.t = now;
  }
  row.n += 1;
  HITS.set(ip, row);
  return row.n > 40;
}

function b64(buf) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

function same(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

async function mintCookie(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const nonce = crypto.randomUUID();
  const msg = exp + "." + nonce;
  return msg + "." + (await sign(secret, msg));
}

async function validCookie(secret, header) {
  const m = String(header || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return false;
  const parts = decodeURIComponent(m[1]).split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, mac] = parts;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expect = await sign(secret, exp + "." + nonce);
  return same(mac, expect);
}

function cookieHeader(token) {
  return COOKIE + "=" + encodeURIComponent(token) +
    "; Path=/; Max-Age=" + SESSION_TTL + "; HttpOnly; Secure; SameSite=None; Partitioned";
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const page = fromOurPage(req, origin, env);
    const secret = (env.TYPESAFE_API_KEY || "").trim();
    if (req.method === "OPTIONS") {
      if (!page) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
    if (!page) return json({ error: { message: "Jev is only available from this lab." } }, 403, origin);
    if (!secret) return json({ error: { message: "Proxy has no TypeSafe key." } }, 500, origin);

    if (path === "/session" && req.method === "GET") {
      const token = await mintCookie(secret);
      return json({ ok: true }, 200, origin, { "Set-Cookie": cookieHeader(token) });
    }

    if (path === "/v1/systemone" && req.method === "POST") {
      if (!(await validCookie(secret, req.headers.get("Cookie")))) {
        return json({ error: { message: "Open the lab in the browser first." } }, 401, origin);
      }
      const ip = req.headers.get("CF-Connecting-IP") || "x";
      if (limited(ip)) return json({ error: { message: "Slow down." } }, 429, origin);
      const body = await req.arrayBuffer();
      if (body.byteLength > 2_000_000) {
        return json({ error: { message: "Request body too large." } }, 413, origin);
      }
      const up = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + secret,
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

    return json({ error: { message: "Not Found" } }, 404, origin);
  }
};
