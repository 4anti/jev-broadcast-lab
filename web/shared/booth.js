import { bootChrome, setCallMeta, setTicker } from "./chrome.js";
import { systemOne } from "./jev-client.js";

export async function bootBooth(id) {
  const cfg = await bootChrome({ booth: id });
  const keyField = document.getElementById("keyField");
  if (keyField && !cfg.hasEnvKey) keyField.style.display = "";
  return cfg;
}

export function apiKey() {
  const cfg = window.__JEV_CFG || {};
  if (cfg.hasEnvKey) return "";
  const el = document.getElementById("apiKey");
  return ((el && el.value) || "").trim();
}

export async function runSystemOne({ state, questions, timeoutMs = 8000 }) {
  const cfg = window.__JEV_CFG || {};
  const data = await systemOne({
    state,
    questions,
    model: cfg.modelDefault || "jev-latest",
    apiKey: apiKey(),
    timeoutMs
  });
  return data;
}

const BAD = /block|jail|harm|hate|spam|threat|danger|critical|sexual_affair|emotional_affair|ad_hominem/i;
const GOOD = /^(pass|allow|safe|none|mild|ok|support|billing|not_cheating|steelman|evidence_cite)$/i;
const WARN = /review|warn|watch|today|micro|community_rule|depends_on_couple/i;
const reduceMotion = () => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (_) { return false; }
};

export function toneOf(name, n) {
  const s = String(name || "");
  if (GOOD.test(s)) return "ok";
  if (WARN.test(s)) return "warn";
  if (BAD.test(s)) return "bad";
  if (typeof n === "number") {
    const x = n > 1 ? n / 3 : n;
    if (x >= 0.7) return "bad";
    if (x >= 0.4) return "warn";
    return "ok";
  }
  return "";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function countTo(node, target, digits, suffix) {
  const end = Number.isFinite(target) ? target : 0;
  const done = () => { node.textContent = (Number.isFinite(target) ? end.toFixed(digits) : "—") + (suffix || ""); };
  if (reduceMotion() || !Number.isFinite(target)) { done(); return; }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / 500);
    node.textContent = (end * p).toFixed(digits) + (suffix || "");
    if (p < 1) requestAnimationFrame(tick);
  };
  node.textContent = (0).toFixed(digits) + (suffix || "");
  requestAnimationFrame(tick);
}

function meter(frac, tone) {
  const wrap = el("div", "meter" + (tone ? " tone-" + tone : ""));
  const i = el("i");
  wrap.appendChild(i);
  const pct = Math.max(0, Math.min(1, Number(frac) || 0)) * 100 + "%";
  if (reduceMotion()) i.style.width = pct;
  else requestAnimationFrame(() => { i.style.width = pct; });
  return wrap;
}

function barRow(label, frac, tone, digits, suffix) {
  const row = el("div", "bar-row" + (tone ? " tone-" + tone : ""));
  row.append(el("span", "k", label), el("span", "v"));
  countTo(row.querySelector(".v"), frac * (suffix === "%" ? 100 : 1), digits, suffix || "");
  row.appendChild(meter(frac, tone));
  return row;
}

export function paintAnswers(host, data) {
  host.textContent = "";
  const answers = (data && data.answers) || {};
  for (const [id, ans] of Object.entries(answers)) {
    const box = el("div", "answer-block");
    box.appendChild(el("h2", "", id));
    if (ans.type === "choice") {
      const tone = toneOf(ans.choice);
      box.classList.add(tone ? "tone-" + tone : "tone-ok");
      const hero = el("div", "score-hero" + (tone ? " tone-" + tone : ""), "");
      hero.textContent = ans.choice || "—";
      box.appendChild(hero);
      if (typeof ans.confidence === "number") box.appendChild(barRow("confidence", ans.confidence, "", 3));
      const ranked = Object.entries(ans.probabilities || {}).sort((a, b) => b[1] - a[1]);
      ranked.slice(0, 8).forEach(([k, v]) => box.appendChild(barRow(k, Number(v) || 0, toneOf(k, Number(v)), 1, "%")));
      if (ranked.length > 8) box.appendChild(el("p", "idle-note", (ranked.length - 8) + " more options not shown"));
    } else if (ans.type === "score") {
      const tone = toneOf(id, ans.score);
      box.classList.add("tone-" + (tone || "ok"));
      const hero = el("div", "score-hero tone-" + (tone || "ok"));
      box.appendChild(hero);
      countTo(hero, ans.score, 3);
      const frac = typeof ans.score === "number" ? (ans.score > 1 ? ans.score / 3 : ans.score) : 0;
      box.appendChild(meter(frac, tone));
      if (typeof ans.confidence === "number") box.appendChild(barRow("confidence", ans.confidence, "", 3));
    } else if (ans.type === "noul") {
      const tone = toneOf(id, ans.noul);
      box.classList.add("tone-" + (tone || "ok"));
      const hero = el("div", "score-hero tone-" + (tone || "ok"));
      box.appendChild(hero);
      countTo(hero, ans.noul, 3);
      box.appendChild(meter(typeof ans.noul === "number" ? ans.noul : 0, tone));
    } else {
      box.appendChild(document.createTextNode(JSON.stringify(ans)));
    }
    host.appendChild(box);
  }
  const usage = data && data.usage;
  setCallMeta({ ms: data && data._ms, tokens: usage && usage.input_tokens, model: data && data.model });
  setTicker((data && data.model) + "  " + Math.round((data && data._ms) || 0) + " ms");
}

export function bindExamples(host, items, apply) {
  if (!host) return;
  host.textContent = "";
  host.classList.add("examples");
  for (const item of items) {
    const btn = el("button", "ex-btn", item.label);
    btn.type = "button";
    btn.addEventListener("click", () => {
      for (const x of host.querySelectorAll("button")) x.classList.toggle("active", x === btn);
      apply(item);
    });
    host.appendChild(btn);
  }
}

export function bindRun(btn, fn) {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try { await fn(); }
    catch (err) {
      setTicker("error " + (err.message || err));
      const out = document.getElementById("out");
      if (out) out.textContent = err.message || String(err);
    } finally { btn.disabled = false; }
  });
}
