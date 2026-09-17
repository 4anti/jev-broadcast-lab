import { siteUrl } from "./site.js";

export const UPSTREAM = "https://api.typesafe.ai/v1/systemone";
export const ENDPOINT = siteUrl("v1/systemone").href;

export function extractError(text) {
  try {
    const j = JSON.parse(text);
    const d = j.error || j.detail || j;
    if (typeof d === "string") return d.slice(0, 240);
    return (d.message || d.error_type || JSON.stringify(d)).slice(0, 240);
  } catch (_) {
    return String(text || "request failed").slice(0, 240);
  }
}

function pagesHost() {
  try {
    return /\.github\.io$/i.test(location.hostname);
  } catch (_) {
    return false;
  }
}

async function post(url, { headers, body, signal }) {
  const t0 = performance.now();
  const res = await fetch(url, { method: "POST", headers, body, signal });
  const ms = performance.now() - t0;
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(extractError(raw));
    err.status = res.status;
    err.ms = ms;
    throw err;
  }
  const data = JSON.parse(raw);
  data._ms = ms;
  return data;
}

export async function systemOne({ state, questions, model = "jev-latest", apiKey = "", timeoutMs = 8000, signal } = {}) {
  const controller = signal ? null : new AbortController();
  const sig = signal || controller.signal;
  const timer = setTimeout(() => {
    if (controller) controller.abort();
  }, timeoutMs);
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  const body = JSON.stringify({ model, state, questions });
  const local = ENDPOINT;
  const first = pagesHost() && apiKey ? UPSTREAM : local;
  try {
    return await post(first, { headers, body, signal: sig });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    if (err instanceof TypeError && first === UPSTREAM) {
      throw new Error("TypeSafe blocked this origin. Run python server.py so the key stays on the server.");
    }
    const canFallback = first === local && apiKey && (!err.status || err.status === 404 || err.status === 405);
    if (!canFallback) throw err;
    try {
      return await post(UPSTREAM, { headers, body, signal: sig });
    } catch (up) {
      if (up instanceof TypeError) {
        throw new Error("TypeSafe blocked this origin. Run python server.py so the key stays on the server.");
      }
      throw up;
    }
  } finally {
    clearTimeout(timer);
  }
}
