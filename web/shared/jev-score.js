// Operator-only career score. Never import this into chess-lab or jev-client.
import { ACCURACY_ACPL_SCALE, SF_SEARCH_DEPTH } from "./sf-eval.js";

export const SCORE_KEY = "jev-lab-arena-score-v1";
export const REVIEW_DEPTH_REF = 18;
export const SF_UCI_ELO_MIN = 1320;
export const SF_UCI_ELO_MAX = 3190;
export const ELO_MIN = 100;
export const ELO_MAX = 2500;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Community game-review ACPL bands (FireChess / typical deep-engine review), not FIDE.
// Depth 10 lite understates loss, so eloFromAcpl scales ACPL by sqrt(18/depth) first.
export const ACPL_ELO = Object.freeze([
  [0, 2500],
  [8, 2400],
  [22, 2000],
  [32, 1800],
  [42, 1600],
  [55, 1400],
  [75, 1200],
  [100, 1000],
  [120, 800],
  [150, 600],
  [180, 400],
  [220, 200],
  [300, 100]
]);

export function depthAdjustedAcpl(acpl, depth = SF_SEARCH_DEPTH) {
  if (!Number.isFinite(acpl) || !Number.isFinite(depth) || depth <= 0) return null;
  return Math.max(0, acpl) * Math.sqrt(REVIEW_DEPTH_REF / depth);
}

function interpolateElo(acpl) {
  const table = ACPL_ELO;
  if (acpl <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (acpl <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + (y1 - y0) * (acpl - x0) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export function eloFromAcpl(acpl, depth = SF_SEARCH_DEPTH) {
  const adjusted = depthAdjustedAcpl(acpl, depth);
  if (adjusted == null) return null;
  return Math.round(clamp(interpolateElo(adjusted), ELO_MIN, ELO_MAX));
}

/** Stockfish UCI_Elo runs 1320–3190. Below that there is no skill level. */
export function skillFromElo(elo) {
  if (!Number.isFinite(elo) || elo < SF_UCI_ELO_MIN) return null;
  const step = (SF_UCI_ELO_MAX - SF_UCI_ELO_MIN) / 20;
  return Math.round(clamp((elo - SF_UCI_ELO_MIN) / step, 0, 20));
}

export function emptyBook() {
  return {
    whiteWins: 0, blackWins: 0, draws: 0,
    jevWins: 0, jevDraws: 0, jevLosses: 0,
    jevPlies: 0, jevLossSum: 0, jevGames: 0
  };
}

export function outcome(game) {
  if (!game?.isGameOver?.()) return null;
  if (game.isCheckmate()) return game.turn() === "w" ? "black" : "white";
  return "draw";
}

/** Jev plies only. Human moves never enter the model score. */
export function jevSample(moves, agents) {
  let jevPlies = 0, jevLossSum = 0;
  for (const move of moves || []) {
    const agent = move.agent || agents?.[move.side];
    if (agent !== "jev" || !Number.isFinite(move.quality?.loss)) continue;
    jevPlies++;
    jevLossSum += move.quality.loss;
  }
  return { jevPlies, jevLossSum };
}

export function applyGame(book, { result, agents, jevPlies, jevLossSum }) {
  if (result !== "white" && result !== "black" && result !== "draw") return book;
  const next = { ...book };
  if (result === "white") next.whiteWins++;
  else if (result === "black") next.blackWins++;
  else next.draws++;
  next.jevGames++;
  const jevWhite = agents?.w === "jev", jevBlack = agents?.b === "jev";
  // Self-play still feeds ACPL, but W-D-L is only Jev vs a human.
  if (jevWhite !== jevBlack) {
    const jevColor = jevWhite ? "white" : "black";
    if (result === "draw") next.jevDraws++;
    else if (result === jevColor) next.jevWins++;
    else next.jevLosses++;
  }
  if (jevPlies > 0) {
    next.jevPlies += jevPlies;
    next.jevLossSum += jevLossSum;
  }
  return next;
}

export function jevStrength({ jevPlies, jevLossSum }) {
  if (!jevPlies) return { acpl: null, accuracy: null, elo: null, skill: null };
  const acpl = Math.round(jevLossSum / jevPlies * 10) / 10;
  const accuracy = Math.round(clamp(100 - ACCURACY_ACPL_SCALE * acpl, 0, 100) * 10) / 10;
  const elo = eloFromAcpl(acpl);
  return { acpl, accuracy, elo, skill: skillFromElo(elo) };
}

export function loadBook(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SCORE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return emptyBook();
    return { ...emptyBook(), ...Object.fromEntries(Object.keys(emptyBook()).map((key) => [key, Number(parsed[key]) || 0])) };
  } catch {
    return emptyBook();
  }
}

export function saveBook(book, storage = globalThis.localStorage) {
  try { storage?.setItem(SCORE_KEY, JSON.stringify(book)); } catch { /* private mode */ }
}
