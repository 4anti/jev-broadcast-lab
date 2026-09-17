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

export function paintAnswers(host, data) {
  host.textContent = "";
  const answers = (data && data.answers) || {};
  for (const [id, ans] of Object.entries(answers)) {
    const box = document.createElement("div");
    box.className = "answer-block";
    const title = document.createElement("h2");
    title.textContent = id;
    box.appendChild(title);
    if (ans.type === "choice") {
      box.appendChild(kv("choice", ans.choice));
      box.appendChild(kv("confidence", fmt(ans.confidence)));
      const probs = ans.probabilities || {};
      Object.entries(probs)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => box.appendChild(kv(k, (Number(v) * 100).toFixed(1) + "%")));
    } else if (ans.type === "score") {
      box.appendChild(kv("score", fmt(ans.score)));
      box.appendChild(kv("confidence", fmt(ans.confidence)));
    } else if (ans.type === "noul") {
      box.appendChild(kv("noul", fmt(ans.noul)));
    } else {
      box.appendChild(document.createTextNode(JSON.stringify(ans)));
    }
    host.appendChild(box);
  }
  const usage = data && data.usage;
  setCallMeta({ ms: data && data._ms, tokens: usage && usage.input_tokens, model: data && data.model });
  setTicker((data && data.model) + "  " + Math.round((data && data._ms) || 0) + " ms");
}

function kv(k, v) {
  const d = document.createElement("div");
  d.className = "kv";
  d.innerHTML = `<span class="k"></span><span class="v"></span>`;
  d.querySelector(".k").textContent = k;
  d.querySelector(".v").textContent = v;
  return d;
}

function fmt(n) {
  return typeof n === "number" ? n.toFixed(3) : "—";
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
