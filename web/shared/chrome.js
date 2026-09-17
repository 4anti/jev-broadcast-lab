import { SITE, siteUrl, pathNorm } from "./site.js";
import { startProxySession } from "./jev-client.js";

const LINKS = [
  { path: "", label: "Home" },
  { path: "arena/", label: "Chess match" },
  { path: "lab/router/", label: "Ticket desk" },
  { path: "lab/guard/", label: "Safety filter" },
  { path: "lab/rank/", label: "Document find" },
  { path: "lab/mod/", label: "Chat mod" },
  { path: "lab/emotion/", label: "Chat emotion" },
  { path: "lab/debate/", label: "Debate move" },
  { path: "lab/cheat/", label: "Cheating or not" },
  { path: "lab/call/", label: "Tool call" },
  { path: "lab/pgn/", label: "PGN puzzles" },
  { path: "lab/loop/", label: "Grid turns" }
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export async function bootChrome({ booth }) {
  const strip = document.createElement("header");
  strip.className = "strip";
  strip.innerHTML = `
    <a class="wordmark" href="${SITE.href}">JEV <span>LAB</span></a>
    <span class="strip-clock" id="labClock">00:00:00</span>
    <div class="strip-meta">
      <span id="labModel">jev-latest</span>
      <span class="pill" id="labKey">key</span>
      <span id="labLat">— ms</span>
      <span id="labTok">in —</span>
    </div>`;

  const rail = document.createElement("nav");
  rail.className = "rail";
  rail.setAttribute("aria-label", "Booths");
  const here = pathNorm(location.pathname);
  const home = pathNorm(SITE.pathname);
  for (const item of LINKS) {
    const url = siteUrl(item.path);
    const a = document.createElement("a");
    a.href = url.href;
    a.textContent = item.label;
    const path = pathNorm(url.pathname);
    const on = item.path ? here === path || here.startsWith(path + "/") : here === home;
    if (on) a.setAttribute("aria-current", "page");
    rail.appendChild(a);
  }

  const ticker = document.createElement("div");
  ticker.className = "ticker";
  ticker.id = "labTicker";
  ticker.innerHTML = "<b>TX</b> Standby.";

  const shell = document.createElement("div");
  shell.className = "shell";
  const main = document.createElement("div");
  main.className = "main";
  while (document.body.firstChild) main.appendChild(document.body.firstChild);
  shell.append(strip, rail, main, ticker);
  document.body.appendChild(shell);

  const tick = () => {
    const d = new Date();
    const el = document.getElementById("labClock");
    if (el) el.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  };
  tick();
  setInterval(tick, 1000);

  if (location.protocol !== "http:" && location.protocol !== "https:") {
    const w = document.createElement("div");
    w.className = "file-warn show";
    w.textContent = "Open via python server.py at http://127.0.0.1:8787. file:// cannot reach Jev.";
    main.prepend(w);
  }

  const key = document.getElementById("labKey");
  const model = document.getElementById("labModel");
  try {
    let cfg = null;
    for (const path of ["config.json", "config"]) {
      const res = await fetch(siteUrl(path));
      if (!res.ok) continue;
      cfg = await res.json();
      break;
    }
    if (!cfg) throw new Error("no config");
    window.__JEV_CFG = cfg;
    if (model) model.textContent = cfg.modelDefault || "jev-latest";
    if (key) {
      key.textContent = cfg.hasEnvKey ? (cfg.proxy ? "proxy" : "env key") : "paste key";
      key.classList.add(cfg.hasEnvKey ? "ok" : "warn");
    }
    if (cfg.proxy) startProxySession().catch(() => {});
  } catch (_) {
    window.__JEV_CFG = { hasEnvKey: false, modelDefault: "jev-latest" };
    if (key) {
      key.textContent = "paste key";
      key.classList.add("warn");
    }
  }

  window.__JEV_BOOTH = booth;
  return window.__JEV_CFG;
}

export function setTicker(text) {
  const el = document.getElementById("labTicker");
  if (!el) return;
  el.textContent = "";
  const b = document.createElement("b");
  b.textContent = "TX";
  el.append(b, document.createTextNode(" " + String(text || "")));
}

export function setCallMeta({ ms, tokens, model } = {}) {
  const lat = document.getElementById("labLat");
  const tok = document.getElementById("labTok");
  const mdl = document.getElementById("labModel");
  if (lat && ms != null) lat.textContent = Math.round(ms) + " ms";
  if (tok && tokens != null) tok.textContent = "in " + tokens;
  if (mdl && model) mdl.textContent = model;
}
