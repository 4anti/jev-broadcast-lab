import { SITE, siteUrl, pathNorm } from "./site.js";

const LINKS = [
  { path: "", id: "CAT-00", label: "Home" },
  { path: "arena/", id: "CAT-01", label: "Arena" },
  { path: "lab/router/", id: "CAT-02", label: "Router" },
  { path: "lab/guard/", id: "CAT-03", label: "Guard" },
  { path: "lab/rank/", id: "CAT-04", label: "Rank" },
  { path: "lab/mod/", id: "CAT-05", label: "Mod" },
  { path: "lab/call/", id: "CAT-06", label: "Caller" },
  { path: "lab/pgn/", id: "CAT-07", label: "PGN" },
  { path: "lab/loop/", id: "CAT-08", label: "Loop" },
  { path: "deck/", id: "CAT-09", label: "Deck" }
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
    a.innerHTML = `<span>${item.label}</span><span class="id">${item.id}</span>`;
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
    w.textContent = "Open via python server.py at http://127.0.0.1:8787 — file:// cannot reach Jev.";
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
