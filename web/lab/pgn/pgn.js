import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";
import "https://cdn.jsdelivr.net/npm/gchessboard@1.4.0/dist/index.es.js";
import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";
import { capMoves } from "../../shared/chess-lab.js";

await bootBooth("pgn");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const board = document.getElementById("board");
let mode = "opening";
board.fen = START;

function setMode(next) {
  mode = next;
  for (const x of document.getElementById("modeSeg").querySelectorAll("button")) {
    const on = x.dataset.mode === mode;
    x.classList.toggle("active", on);
    x.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

document.getElementById("modeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  setMode(b.dataset.mode);
});

bindExamples(document.getElementById("examples"), [
  { label: "Opening", mode: "opening" },
  { label: "Scholar mate", mode: "blunder", pgn: "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#" },
  { label: "Quiet line", mode: "blunder", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" },
  { label: "Mate in one", mode: "puzzle", fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1" },
  { label: "Middlegame miss", mode: "blunder", pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 Ng4 7. Qxg4" }
], (item) => {
  setMode(item.mode);
  if (item.pgn) document.getElementById("pgn").value = item.pgn;
  if (item.fen) document.getElementById("fen").value = item.fen;
});

function localFacts(game) {
  const last = game.history({ verbose: true }).slice(-1)[0];
  return {
    in_check: game.inCheck(),
    game_over: game.isGameOver(),
    checkmate: game.isCheckmate(),
    last_san: last ? last.san : null,
    last_capture: last ? Boolean(last.captured) : false
  };
}

bindRun(document.getElementById("runBtn"), async () => {
  const factsEl = document.getElementById("facts");
  if (mode === "opening") {
    const g = new Chess();
    board.fen = g.fen();
    const moves = g.moves({ verbose: true }).slice(0, 8);
    const criteria = {};
    for (const m of moves) criteria[m.lan] = m.san;
    const data = await runSystemOne({
      state: { fen: g.fen(), stm: "w" },
      questions: {
        open: {
          type: "choice",
          instructions: "Pick a first-move LAN for White.",
          criteria
        }
      }
    });
    const lan = data.answers && data.answers.open && data.answers.open.choice;
    const mv = moves.find((m) => m.lan === lan);
    if (mv) {
      g.move({ from: mv.from, to: mv.to });
      board.fen = g.fen();
    }
    factsEl.textContent = "Opening Choice among " + moves.length + " LANs. chess.js applied the pick if legal.";
    paintAnswers(document.getElementById("out"), data);
    return;
  }

  if (mode === "blunder") {
    const g = new Chess();
    try {
      g.loadPgn(document.getElementById("pgn").value);
    } catch (_) {
      factsEl.textContent = "PGN rejected by chess.js.";
      return;
    }
    board.fen = g.fen();
    const facts = localFacts(g);
    const data = await runSystemOne({
      state: { fen: g.fen(), last_san: facts.last_san, stm: g.turn() },
      questions: {
        blunder: {
          type: "noul",
          instructions: "The last move was a blunder."
        }
      }
    });
    const noul = data.answers && data.answers.blunder && data.answers.blunder.noul;
    factsEl.textContent =
      "Jev blunder Noul=" + (typeof noul === "number" ? noul.toFixed(3) : "—") +
      ". Local: check=" + facts.in_check +
      " mate=" + facts.checkmate +
      " capture=" + facts.last_capture +
      ". Noul is calibration, not a tablebase.";
    paintAnswers(document.getElementById("out"), data);
    return;
  }

  const fen = document.getElementById("fen").value.trim();
  let g;
  try { g = new Chess(fen); } catch (_) {
    factsEl.textContent = "FEN rejected by chess.js.";
    return;
  }
  board.fen = g.fen();
  const { sent, legal } = capMoves(g.moves({ verbose: true }), 8);
  const criteria = {};
  for (const m of sent) criteria[m.lan] = m.san;
  const data = await runSystemOne({
    state: { fen: g.fen(), stm: g.turn(), sent: sent.length, legal },
    questions: {
      pick: {
        type: "choice",
        instructions: "Pick the puzzle key move. Keys are LAN. Shortlist only.",
        criteria
      },
      quality: {
        type: "score",
        instructions: "How forcing is the best idea here for the side to move?",
        criteria: ["Quiet", "Useful", "Strong", "Winning"]
      }
    }
  });
  const lan = data.answers && data.answers.pick && data.answers.pick.choice;
  const mv = sent.find((m) => m.lan === lan);
  if (mv) {
    g.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    board.fen = g.fen();
  }
  factsEl.textContent = "Puzzle shortlist " + sent.length + " / legal " + legal + ".";
  paintAnswers(document.getElementById("out"), data);
});
