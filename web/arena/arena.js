import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";
import "https://cdn.jsdelivr.net/npm/gchessboard@1.4.0/dist/index.es.js";
import { bootChrome, setTicker, setCallMeta } from "../shared/chrome.js";
import { systemOne } from "../shared/jev-client.js";
import { buildMoveQuestions, DEFAULT_WHITE, DEFAULT_BLACK, resultText } from "../shared/chess-lab.js";
import { ArenaReview } from "./operator-review.js";

const PROMO = ["q", "r", "b", "n"];
const GLYPH = { q: "♛", r: "♜", b: "♝", n: "♞" };
const $ = (id) => document.getElementById(id);

const board = $("board");
const state = {
  game: new Chess(),
  startFen: new Chess().fen(),
  whiteAgent: "human",
  blackAgent: "jev",
  humanColor: "w",
  mode: "hvj",
  playAs: "white",
  paused: true,
  stepOnce: false,
  aborted: false,
  thinking: false,
  serial: 0,
  abortCtl: null,
  viewPly: 0,
  pendingPromo: null,
  last: { w: null, b: null },
  pendingRetry: false
};
// Review owns all engine results; the Jev request below only consumes chess-lab output.
const review = new ArenaReview({ onPly: viewPly, onUpdate: renderHistory });

$("whiteInstr").value = DEFAULT_WHITE;
$("blackInstr").value = DEFAULT_BLACK;

function livePly() { return state.game.history().length; }
function isLive() { return state.viewPly === livePly(); }
function turn() { return state.game.turn(); }
function agentFor(side) { return side === "w" ? state.whiteAgent : state.blackAgent; }

function setSeg(root, attr, value) {
  for (const b of root.querySelectorAll("button")) {
    const on = b.dataset[attr] === value;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function status(text) { $("statusText").textContent = text; }

function syncBoard(fen) {
  const orient = state.mode === "jvj" ? "white" : (state.humanColor === "b" ? "black" : "white");
  board.setAttribute("orientation", orient);
  board.fen = fen;
  const hist = state.game.history({ verbose: true });
  const last = hist[state.viewPly - 1];
  try { board.arrows = last ? [[last.from, last.to]] : []; } catch (_) { /* optional */ }
  review.display(state.viewPly, orient);
}

function canHuman() {
  return (
    isLive() &&
    !state.game.isGameOver() &&
    !state.thinking &&
    !state.pendingRetry &&
    agentFor(turn()) === "human"
  );
}

function updateInteractive() {
  if (canHuman()) board.setAttribute("interactive", "");
  else board.removeAttribute("interactive");
  if (state.humanColor && state.mode === "hvj") board.turn = state.humanColor;
}

function renderHistory() {
  const hist = state.game.history({ verbose: true });
  const el = $("history");
  const focusedPly = el.contains(document.activeElement) ? document.activeElement.dataset.ply : null;
  el.textContent = "";
  if (!hist.length) {
    el.textContent = "Ply 0.";
    return;
  }
  for (let i = 0; i < hist.length; i += 2) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const num = document.createElement("span");
    num.className = "hist-num";
    num.textContent = (i / 2 + 1) + ".";
    row.appendChild(num);
    const mk = (m, ply) => {
      const b = document.createElement("button");
      b.dataset.ply = String(ply);
      b.className = "ply" + (state.viewPly === ply ? " active" : "") + (ply === livePly() ? " chase" : "");
      b.textContent = m.san;
      const quality = review.qualityAt(ply);
      if (quality) {
        const glyph = document.createElement("span");
        glyph.className = "ply-quality quality-" + quality.label.toLowerCase();
        glyph.textContent = " " + quality.glyph;
        b.appendChild(glyph);
        b.title = quality.label + " · " + quality.loss + " cp loss";
        b.setAttribute("aria-label", m.san + ", " + quality.label);
      }
      b.addEventListener("click", () => viewPly(ply));
      return b;
    };
    row.appendChild(mk(hist[i], i + 1));
    if (hist[i + 1]) row.appendChild(mk(hist[i + 1], i + 2));
    else row.appendChild(document.createElement("span"));
    el.appendChild(row);
  }
  if (focusedPly) el.querySelector(`[data-ply="${focusedPly}"]`)?.focus({ preventScroll: true });
}

function viewPly(ply) {
  ply = Math.max(0, Math.min(livePly(), ply));
  state.viewPly = ply;
  const hist = state.game.history({ verbose: true });
  syncBoard(ply === 0 ? state.startFen : hist[ply - 1].after);
  paintPlayhead();
  updateInteractive();
  renderHistory();
  if (!isLive()) status("Review ply " + ply + " / " + livePly());
  else refreshStatus();
}

function goLive() {
  state.viewPly = livePly();
  syncBoard(state.game.fen());
  paintPlayhead();
  updateInteractive();
  renderHistory();
  refreshStatus();
}

function paintPlayhead() {
  const move = state.game.history({ verbose: true })[state.viewPly - 1];
  $("ltSan").textContent = move ? move.san : "—";
  $("ltLan").textContent = move ? move.lan + " · ply " + state.viewPly : "Starting position";
}

function paintPlate(side, d) {
  const p = side === "w" ? "white" : "black";
  $(p + "Last").textContent = d ? d.san + "  " + d.lan : "—";
  $(p + "Conf").textContent = d && typeof d.confidence === "number" ? d.confidence.toFixed(2) : "—";
  const bar = $(p + "Bar");
  bar.style.width = d && typeof d.confidence === "number" ? (d.confidence * 100) + "%" : "0%";
  const top = $(p + "Top");
  top.textContent = "";
  (d && d.top ? d.top : []).forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "top-row" + (i === 0 ? " lead" : "");
    row.innerHTML = `<span>${i + 1}</span><span>${t.san} <span style="color:var(--mute)">${t.lan}</span></span><span>${(t.prob * 100).toFixed(1)}%</span>`;
    top.appendChild(row);
  });
}

function refreshStatus() {
  const g = state.game;
  if (g.isGameOver()) {
    status(resultText(g));
    setTicker(resultText(g));
    $("pauseBtn").disabled = true;
    $("stepBtn").disabled = true;
    return;
  }
  if (state.pendingRetry) { status("Jev failed — retry."); return; }
  if (state.thinking) { status("Jev on program…"); return; }
  if (state.paused && agentFor(turn()) === "jev") { status("Paused."); return; }
  if (agentFor(turn()) === "human") status((g.inCheck() ? "Check. " : "") + "Your move.");
  else status((g.inCheck() ? "Check. " : "") + "Waiting for Jev.");
}

function sleep(ms, serial) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    const i = setInterval(() => {
      if (serial !== state.serial) {
        clearTimeout(t);
        clearInterval(i);
        resolve();
      }
    }, 50);
    setTimeout(() => clearInterval(i), ms + 20);
  });
}

async function requestJevMove() {
  if (state.thinking) return false;
  const g = state.game;
  const cfg = window.__JEV_CFG || {};
  const key = cfg.hasEnvKey ? "" : ($("apiKey").value || "").trim();
  if (!cfg.hasEnvKey && !key) {
    state.pendingRetry = true;
    $("retryBtn").style.display = "";
    status("Add a TypeSafe key in the rack, or set TYPESAFE_API_KEY.");
    return false;
  }
  const side = turn();
  const serial = state.serial;
  const fenAt = g.fen();
  const instr = side === "w" ? $("whiteInstr").value : $("blackInstr").value;
  const built = buildMoveQuestions(g, {
    cap: $("cap").value,
    compact: $("payload").value === "compact",
    instructions: instr,
    analyst: $("analyst").checked
  });
  $("sentLegal").textContent = built.sent.length + " / " + built.legal;
  state.thinking = true;
  state.pendingRetry = false;
  $("retryBtn").style.display = "none";
  $(side === "w" ? "whitePlate" : "blackPlate").className = "plate live";
  updateInteractive();
  refreshStatus();

  const ctl = new AbortController();
  state.abortCtl = ctl;
  try {
    const data = await systemOne({
      state: built.state,
      questions: built.questions,
      model: (cfg.modelDefault || "jev-latest"),
      apiKey: key,
      timeoutMs: Number($("timeout").value) || 8000,
      signal: ctl.signal
    });
    if (serial !== state.serial || state.game.fen() !== fenAt) return false;
    const ans = data.answers && data.answers.move;
    const choice = ans && ans.choice;
    if (!choice || !built.map.has(choice)) {
      throw { kind: "unknown", detail: "Choice not in sent LAN set." };
    }
    const move = built.map.get(choice);
    state.game.move({ from: move.from, to: move.to, promotion: move.promotion });
    review.record(state.game);
    const probs = ans.probabilities || {};
    const top = Object.entries(probs)
      .map(([lan, p]) => {
        const mv = built.map.get(lan);
        return { lan, san: mv ? (mv.tag || mv.san) : lan, prob: Number(p) || 0 };
      })
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5);
    const dec = {
      san: move.san,
      lan: choice,
      confidence: ans.confidence,
      top,
      tokens: data.usage && data.usage.input_tokens,
      model: data.model
    };
    state.last[side] = dec;
    paintPlate(side, dec);
    $("ltSan").textContent = move.san;
    $("ltLan").textContent = (move.tag || choice) + " · Jev mass, not engine eval";
    $("tokLine").textContent = (data.usage && data.usage.input_tokens) + " in";
    setCallMeta({ ms: data._ms, tokens: data.usage && data.usage.input_tokens, model: data.model });
    setTicker(move.san + "  " + choice + "  conf " + (typeof ans.confidence === "number" ? ans.confidence.toFixed(2) : "—"));
    if ($("analyst").checked && data.answers) {
      const a = data.answers;
      $("analystOut").style.display = "block";
      $("analystOut").textContent =
        "plan " + (a.plan && a.plan.choice) +
        " · quality " + (a.quality && a.quality.score) +
        " · sharp " + (a.sharp && a.sharp.noul);
    }
    state.viewPly = livePly();
    syncBoard(state.game.fen());
    renderHistory();
    return true;
  } catch (err) {
    if (serial !== state.serial || err.name === "AbortError") return false;
    state.pendingRetry = true;
    $("retryBtn").style.display = "";
    status((err && err.message) || "Jev request failed.");
    setTicker("error " + ((err && err.message) || "fail"));
    return false;
  } finally {
    if (serial === state.serial && state.abortCtl === ctl) {
      state.thinking = false;
      state.abortCtl = null;
      $(side === "w" ? "whitePlate" : "blackPlate").className = "plate wait";
      updateInteractive();
      refreshStatus();
    }
  }
}

async function loop() {
  const serial = state.serial;
  while (serial === state.serial) {
    if (state.thinking) return;
    if (state.game.isGameOver()) { refreshStatus(); return; }
    if (state.paused && !state.stepOnce) { refreshStatus(); return; }
    const who = agentFor(turn());
    if (who === "human") {
      state.stepOnce = false;
      updateInteractive();
      refreshStatus();
      return;
    }
    const ok = await requestJevMove();
    if (serial !== state.serial) return;
    if (!ok) return;
    if (state.stepOnce) {
      state.stepOnce = false;
      state.paused = true;
      $("pauseBtn").textContent = "Resume";
      refreshStatus();
      return;
    }
    const pace = Number($("pace").value) || 0;
    await sleep(pace, serial);
  }
}

function abortMatch() {
  state.serial += 1;
  state.aborted = true;
  if (state.abortCtl) state.abortCtl.abort();
  state.abortCtl = null;
  state.thinking = false;
}

function startMatch() {
  const fen = $("fenIn").value.trim();
  let nextGame;
  try {
    nextGame = fen ? new Chess(fen) : new Chess();
  } catch (_) {
    status("FEN rejected by chess.js.");
    return;
  }
  abortMatch();
  state.aborted = false;
  state.pendingRetry = false;
  $("retryBtn").style.display = "none";
  state.game = nextGame;
  state.startFen = state.game.fen();
  state.pendingPromo = null;
  $("promoOverlay").classList.remove("show");
  if (state.mode === "jvj") {
    state.whiteAgent = "jev";
    state.blackAgent = "jev";
    state.humanColor = null;
    $("pace").value = $("pace").value === "0" ? "400" : $("pace").value;
  } else {
    const side = state.playAs === "random" ? (Math.random() < 0.5 ? "w" : "b") : (state.playAs === "black" ? "b" : "w");
    state.humanColor = side;
    state.whiteAgent = side === "w" ? "human" : "jev";
    state.blackAgent = side === "b" ? "human" : "jev";
    $("pace").value = "0";
  }
  $("whiteAgent").textContent = state.whiteAgent;
  $("blackAgent").textContent = state.blackAgent;
  review.reset(state.game, { w: state.whiteAgent, b: state.blackAgent });
  state.last = { w: null, b: null };
  paintPlate("w", null);
  paintPlate("b", null);
  state.paused = false;
  state.stepOnce = false;
  state.viewPly = 0;
  $("pauseBtn").disabled = false;
  $("stepBtn").disabled = false;
  $("pauseBtn").textContent = "Pause";
  $("startBtn").textContent = "New match";
  $("sentLegal").textContent = "—";
  $("tokLine").textContent = "—";
  $("analystOut").style.display = "none";
  $("ltSan").textContent = "—";
  $("ltLan").textContent = "live";
  goLive();
  void loop();
}

$("modeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  state.mode = b.dataset.mode;
  setSeg($("modeSeg"), "mode", state.mode);
  $("humanSideWrap").style.display = state.mode === "jvj" ? "none" : "";
});
$("sideSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-side]");
  if (!b) return;
  state.playAs = b.dataset.side;
  setSeg($("sideSeg"), "side", state.playAs);
});
$("startBtn").addEventListener("click", startMatch);
$("pauseBtn").addEventListener("click", () => {
  state.paused = !state.paused;
  $("pauseBtn").textContent = state.paused ? "Resume" : "Pause";
  if (!state.paused) void loop();
  else refreshStatus();
});
$("stepBtn").addEventListener("click", () => {
  state.stepOnce = true;
  state.paused = false;
  void loop();
});
$("retryBtn").addEventListener("click", () => {
  state.pendingRetry = false;
  $("retryBtn").style.display = "none";
  void loop();
});
$("prevPly").addEventListener("click", () => viewPly(state.viewPly - 1));
$("nextPly").addEventListener("click", () => viewPly(state.viewPly + 1));
$("livePly").addEventListener("click", goLive);

board.addEventListener("movestart", (e) => {
  const setTargets = e.detail && e.detail.setTargets;
  const from = e.detail && e.detail.from;
  if (!canHuman() || !from) { if (setTargets) setTargets([]); return; }
  const piece = state.game.get(from);
  if (!piece || piece.color !== state.humanColor) { if (setTargets) setTargets([]); return; }
  const moves = state.game.moves({ square: from, verbose: true });
  if (setTargets) setTargets([...new Set(moves.map((m) => m.to))]);
});
board.addEventListener("moveend", (e) => {
  e.preventDefault();
  const from = e.detail && e.detail.from;
  const to = e.detail && e.detail.to;
  if (!canHuman() || !from || !to) { syncBoard(state.game.fen()); updateInteractive(); return; }
  const legal = state.game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!legal.length) { syncBoard(state.game.fen()); return; }
  if (legal.length > 1) {
    state.pendingPromo = { from, to, options: legal };
    const box = $("promoChoices");
    box.textContent = "";
    for (const p of PROMO) {
      const opt = legal.find((m) => m.promotion === p);
      if (!opt) continue;
      const b = document.createElement("button");
      b.className = "promo-btn";
      b.textContent = GLYPH[p];
      b.addEventListener("click", () => {
        commitHuman(opt);
        $("promoOverlay").classList.remove("show");
        state.pendingPromo = null;
      });
      box.appendChild(b);
    }
    $("promoOverlay").classList.add("show");
    return;
  }
  commitHuman(legal[0]);
});
function commitHuman(move) {
  try {
    state.game.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch (_) {
    syncBoard(state.game.fen());
    return;
  }
  $("ltSan").textContent = move.san;
  $("ltLan").textContent = move.lan || (move.from + move.to);
  state.viewPly = livePly();
  state.last[move.color] = { san: move.san, lan: move.lan };
  paintPlate(move.color, state.last[move.color]);
  review.record(state.game);
  syncBoard(state.game.fen());
  renderHistory();
  updateInteractive();
  refreshStatus();
  if (!state.game.isGameOver()) void loop();
}
$("promoCancel").addEventListener("click", () => {
  $("promoOverlay").classList.remove("show");
  state.pendingPromo = null;
  syncBoard(state.game.fen());
});

document.addEventListener("keydown", (e) => {
  if (e.target && (e.target.closest("input, textarea, select, button, [role=slider]"))) return;
  if (e.key === "ArrowLeft") viewPly(state.viewPly - 1);
  if (e.key === "ArrowRight") viewPly(state.viewPly + 1);
  if (e.key === "l" || e.key === "L") goLive();
  if (e.code === "Space") {
    e.preventDefault();
    if (!$("pauseBtn").disabled) $("pauseBtn").click();
  }
});

const cfg = await bootChrome({ booth: "arena" });
if (!cfg.hasEnvKey) $("keyField").style.display = "";
review.reset(state.game, { w: "human", b: "jev" });
syncBoard(state.game.fen());
renderHistory();
$("whiteAgent").textContent = "human";
$("blackAgent").textContent = "jev";
