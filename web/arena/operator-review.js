// Spectator-only data. Nothing in this module is passed to buildMoveQuestions/systemOne.
import { materialAdvantage } from "../shared/chess-lab.js";
import { StockfishEvaluator, classifyMove, summarizeMoves, evaluationCp } from "../shared/sf-eval.js";
import { applyGame, emptyBook, jevSample, jevStrength, loadBook, outcome, saveBook } from "../shared/jev-score.js";

const $ = (id) => document.getElementById(id);
const INITIAL = { q: 1, r: 2, b: 2, n: 2, p: 8 };
const PIECES = { w: { q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" }, b: { q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" } };
const SVG = "http://www.w3.org/2000/svg";

export function missingPieces(game) {
  const counts = { w: {}, b: {} };
  for (const row of game.board()) for (const p of row) {
    if (p) counts[p.color][p.type] = (counts[p.color][p.type] || 0) + 1;
  }
  const missing = { w: [], b: [] };
  for (const side of ["w", "b"]) for (const type of Object.keys(INITIAL)) {
    for (let n = counts[side][type] || 0; n < INITIAL[type]; n++) missing[side].push(type);
  }
  return missing;
}

function evaluationText(value) {
  if (!value) return "—";
  if (value.mate != null) return (evaluationCp(value) < 0 ? "−" : "+") + "M" + Math.abs(value.mate);
  return (value.cp > 0 ? "+" : "") + (value.cp / 100).toFixed(1);
}

function graphScore(value) {
  return evaluationCp(value);
}

function svgElement(name, attrs) {
  const el = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

export class ArenaReview {
  constructor({ onPly, onUpdate }) {
    this.onPly = onPly;
    this.onUpdate = onUpdate;
    this.enabled = $("operatorReview").checked;
    this.generation = 0;
    this.positions = [];
    this.moves = [];
    this.viewPly = 0;
    this.orientation = "white";
    this.agents = { w: "human", b: "jev" };
    this.committed = false;
    this.book = loadBook();
    this.engineStatus = "Loading Stockfish…";
    $("resetScore").addEventListener("click", () => {
      this.book = emptyBook();
      saveBook(this.book);
      this.renderCareer();
    });
    $("operatorReview").addEventListener("change", () => this.setEnabled($("operatorReview").checked));
    $("evalGraph").addEventListener("click", (event) => {
      const rect = $("evalGraph").getBoundingClientRect();
      // The graph has 16 units of inset on its 640-unit viewBox.
      const fraction = ((event.clientX - rect.left) / rect.width * 640 - 16) / 608;
      this.onPly(Math.round(Math.max(0, Math.min(1, fraction)) * this.moves.length));
    });
    $("evalGraph").addEventListener("keydown", (event) => {
      const target = { ArrowLeft: this.viewPly - 1, ArrowRight: this.viewPly + 1, Home: 0, End: this.moves.length }[event.key];
      if (target == null) return;
      event.preventDefault();
      event.stopPropagation();
      this.onPly(target);
    });
  }

  createEngine() {
    if (!this.engine) this.engine = new StockfishEvaluator({ onStatus: ({ message }) => {
      this.engineStatus = message;
      this.render();
    } });
  }

  reset(game, agents) {
    this.finalize(true);
    this.generation++;
    this.engine?.reset();
    this.positions = [];
    this.moves = [];
    this.viewPly = 0;
    this.committed = false;
    this.gameOver = false;
    if (agents) this.agents = { w: agents.w, b: agents.b };
    this.record(game);
  }

  record(game) {
    const hist = game.history({ verbose: true });
    if (hist.length) {
      const move = hist[hist.length - 1];
      this.moves[hist.length - 1] = { side: move.color, lan: move.lan, quality: null, agent: this.agents[move.color] };
    }
    this.positions[hist.length] = {
      fen: game.fen(), material: materialAdvantage(game), missing: missingPieces(game),
      evaluation: null, pending: false, error: null
    };
    this.game = game;
    this.gameOver = game.isGameOver();
    this.viewPly = hist.length;
    if (this.enabled) this.schedule();
    this.render();
  }

  finalize(force) {
    if (this.committed || !this.gameOver) return;
    if (!force && this.enabled && this.positions.some((position) => position.pending)) return;
    const result = outcome(this.game);
    if (!result) return;
    this.committed = true;
    this.book = applyGame(this.book, { result, agents: this.agents, ...jevSample(this.moves, this.agents) });
    saveBook(this.book);
  }

  renderCareer() {
    const live = this.committed ? { jevPlies: 0, jevLossSum: 0 } : jevSample(this.moves, this.agents);
    const strength = jevStrength({
      jevPlies: this.book.jevPlies + live.jevPlies,
      jevLossSum: this.book.jevLossSum + live.jevLossSum
    });
    $("jevElo").textContent = strength.elo == null ? "—" : String(strength.elo);
    $("jevSkill").textContent = strength.elo == null ? "—" : strength.skill == null ? "below Stockfish (1320)" : "SF " + strength.skill + " / 20";
    $("jevWdl").textContent = this.book.jevWins + "-" + this.book.jevDraws + "-" + this.book.jevLosses;
    $("colorWins").textContent = this.book.whiteWins + " / " + this.book.blackWins;
    $("drawCount").textContent = String(this.book.draws);
    $("jevCareerAcc").textContent = strength.accuracy == null ? "—" : strength.accuracy.toFixed(1) + "%";
    $("jevCareerAcpl").textContent = strength.acpl == null ? "—" : strength.acpl.toFixed(1);
    $("jevGames").textContent = String(this.book.jevGames);
    $("jevElo").title = "Community ACPL bands after scaling depth-10 loss to a typical depth-18 review. Stockfish UCI_Elo starts at 1320. Not FIDE.";
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.generation++;
    this.engine?.destroy();
    this.engine = null;
    for (const position of this.positions) {
      position.pending = false;
      position.error = null;
    }
    if (enabled) this.schedule();
    this.render();
    this.onUpdate();
  }

  schedule() {
    this.createEngine();
    const generation = this.generation;
    this.positions.forEach((position) => {
      if (position.evaluation || position.pending || position.error) return;
      position.pending = true;
      this.engine.evaluate(position.fen).then((evaluation) => {
        if (generation !== this.generation) return;
        position.evaluation = evaluation;
        position.pending = false;
        for (let i = 0; i < this.moves.length; i++) {
          const move = this.moves[i];
          move.quality = classifyMove(this.positions[i].evaluation, this.positions[i + 1].evaluation, move.side, move.lan);
        }
        this.render();
        this.onUpdate();
      }).catch((error) => {
        if (generation !== this.generation || error.name === "AbortError") return;
        position.pending = false;
        position.error = error.message || "Stockfish unavailable";
        this.render();
      });
    });
  }

  qualityAt(ply) { return this.enabled ? this.moves[ply - 1]?.quality : null; }

  scorecard() {
    return {
      summary: summarizeMoves(this.moves),
      strength: jevStrength(jevSample(this.moves, this.agents)),
      pending: this.enabled && this.positions.some((position) => position.pending),
      ply: this.moves.length,
      agents: this.agents
    };
  }

  display(ply, orientation) {
    this.viewPly = ply;
    this.orientation = orientation;
    this.render();
  }

  renderMaterial(position) {
    const top = this.orientation === "black" ? "w" : "b";
    for (const [slot, side] of [["top", top], ["bottom", top === "w" ? "b" : "w"]]) {
      const captured = side === "w" ? "b" : "w";
      const name = side === "w" ? "White" : "Black";
      $(slot + "CaptureSide").textContent = name;
      $(slot + "Captures").textContent = position.missing[captured].map((type) => PIECES[captured][type]).join("") || "—";
      $(slot + "Captures").setAttribute("aria-label", `${name}: missing opposing pieces versus standard start: ${position.missing[captured].join(" ") || "none"}`);
      $(slot + "Captures").title = "Missing opposing pieces versus standard start; promotions can change this inventory.";
      const advantage = side === "w" ? position.material.white : position.material.black;
      $(slot + "Material").textContent = advantage ? "+" + advantage : "";
    }
    for (const [side, prefix] of [["w", "white"], ["b", "black"]]) {
      const net = position.material.net * (side === "w" ? 1 : -1);
      $(prefix + "Material").textContent = net === 0 ? "even" : net > 0 ? "+" + net : String(net);
    }
  }

  render() {
    const position = this.positions[this.viewPly];
    if (!position) return;
    this.renderMaterial(position);
    this.finalize();
    this.renderCareer();
    $("evalBar").hidden = !this.enabled;
    $("reviewHud").hidden = !this.enabled;
    document.querySelectorAll(".operator-metrics").forEach((el) => { el.hidden = !this.enabled; });
    if (!this.enabled) return;
    const value = position.evaluation;
    const score = value ? graphScore(value) : 0;
    const white = value?.mate != null ? (score < 0 ? 0 : 100) : 50 + 50 * Math.tanh(score / 400);
    $("evalFill").style.height = white + "%";
    $("evalFill").style.bottom = this.orientation === "black" ? "auto" : "0";
    $("evalFill").style.top = this.orientation === "black" ? "0" : "auto";
    $("evalValue").textContent = evaluationText(value);
    $("evalDirection").textContent = !value ? "Awaiting eval" : score > 0 ? "White ahead" : score < 0 ? "Black ahead" : "Equal";
    $("evalBar").setAttribute("aria-label", `Stockfish, White perspective: ${evaluationText(value)}`);
    $("reviewPly").textContent = `Ply ${this.viewPly} / ${this.moves.length}`;
    const pending = this.positions.filter((p) => p.pending).length;
    const failed = this.positions.filter((p) => p.error).length;
    $("reviewStatus").textContent = failed ? "Stockfish unavailable · toggle review to retry" : pending ? `Analyzing · ${pending} position${pending === 1 ? "" : "s"} queued` : value ? `Depth ${value.depth} · White perspective` : this.engineStatus;
    const quality = this.qualityAt(this.viewPly);
    $("moveQuality").textContent = quality ? quality.label + (quality.glyph ? " " + quality.glyph : "") : this.viewPly ? (failed ? "Unrated" : "Analyzing move…") : "Starting position";
    $("moveQuality").className = "move-quality" + (quality ? " quality-" + quality.label.toLowerCase() : "");
    $("moveQuality").title = quality ? `${quality.loss} centipawn loss (capped); local review thresholds` : "";
    const summary = summarizeMoves(this.moves.slice(0, this.viewPly));
    for (const [side, prefix] of [["w", "white"], ["b", "black"]]) {
      const stats = summary[side];
      $(prefix + "Accuracy").textContent = stats.accuracy == null ? "—" : stats.accuracy.toFixed(1) + "%";
      $(prefix + "Acpl").textContent = stats.acpl == null ? "—" : stats.acpl.toFixed(1);
      $(prefix + "Errors").textContent = `${stats.inaccuracies} / ${stats.mistakes} / ${stats.blunders}`;
      const total = this.moves.slice(0, this.viewPly).filter((move) => move.side === side).length;
      $(prefix + "ReviewCount").textContent = `${stats.count} / ${total} plies rated`;
      $(prefix + "ScoreLabel").textContent = this.gameOver && this.viewPly === this.moves.length ? "Game scorecard" : "Operator score";
    }
    this.renderGraph();
  }

  renderGraph() {
    const graph = $("evalGraph");
    graph.replaceChildren();
    graph.setAttribute("viewBox", "0 0 640 100");
    graph.setAttribute("preserveAspectRatio", "none");
    graph.setAttribute("role", "slider");
    graph.setAttribute("tabindex", "0");
    graph.setAttribute("aria-label", "Stockfish evaluation by ply; use arrow keys to review");
    graph.setAttribute("aria-valuemin", "0");
    graph.setAttribute("aria-valuemax", String(this.moves.length));
    graph.setAttribute("aria-valuenow", String(this.viewPly));
    graph.setAttribute("aria-valuetext", `Ply ${this.viewPly}, ${evaluationText(this.positions[this.viewPly]?.evaluation)}`);
    graph.append(svgElement("line", { x1: 16, x2: 624, y1: 50, y2: 50, class: "eval-zero" }));
    const x = (ply) => 16 + 608 * ply / Math.max(1, this.moves.length);
    const y = (value) => 50 - graphScore(value) / 1000 * 42;
    let path = "";
    let connected = false;
    this.positions.forEach((position, ply) => {
      if (!position.evaluation) { connected = false; return; }
      path += `${connected ? "L" : "M"}${x(ply)},${y(position.evaluation)} `;
      connected = true;
      graph.append(svgElement("circle", { cx: x(ply), cy: y(position.evaluation), r: 2.5, class: "eval-point" }));
    });
    graph.append(svgElement("path", { d: path, class: "eval-line", fill: "none" }));
    graph.append(svgElement("line", { x1: x(this.viewPly), x2: x(this.viewPly), y1: 4, y2: 96, class: "eval-cursor" }));
    $("evalGraphEmpty").hidden = this.positions.some((position) => position.evaluation);
  }
}
