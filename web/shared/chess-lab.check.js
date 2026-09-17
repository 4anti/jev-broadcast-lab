import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { analyzePosition, buildMoveQuestions, capMoves, classifyPosition, DEFAULT_WHITE, formatTag, materialAdvantage, materialNet } from "./chess-lab.js";

const raw = [
  { lan: "a2a3", san: "a3", to: "a3" },
  { lan: "b2b4", san: "b4", to: "b4" },
  { lan: "c2c4", san: "c4", to: "c4" },
  { lan: "g1f3", san: "Nf3", to: "f3" },
  { lan: "d1h5", san: "Qh5+", to: "h5" },
  { lan: "d1h8", san: "Qh8#", to: "h8" },
  { lan: "e4d5", san: "exd5", to: "d5", captured: "p" }
];

const { sent, legal } = capMoves(raw, 3);
const sans = sent.map((m) => m.san);
if (legal !== 7) throw new Error("legal count");
if (sent.length !== 1 || sans[0] !== "Qh8#") throw new Error("raw mate-only pool");
if (capMoves(raw, 1).sent[0].san !== "Qh8#") throw new Error("cap 1 must be mate");

const notes = [
  { lan: "a2a3", san: "a3", to: "a3", tag: "a3", mate: false, stale: false, check: false, threefold: false, gain: 0, hangs: false, piece: "p" },
  { lan: "d1h8", san: "Qh8#", to: "h8", tag: "Qh8# mate", mate: true, stale: false, check: true, threefold: false, gain: 0, hangs: false, piece: "q" },
  { lan: "a1a8", san: "Ra8", to: "a8", tag: "Ra8 stalemate", mate: false, stale: true, check: false, threefold: false, gain: 0, hangs: false, piece: "r" }
];
const only = capMoves(notes, 8);
if (only.sent.length !== 1 || !only.sent[0].mate) throw new Error("mate-only pool");

const noMate = [
  { lan: "a2a3", san: "a3", to: "a3", tag: "a3", mate: false, stale: false, check: false, threefold: false, gain: 0, hangs: false, piece: "p" },
  { lan: "a1a8", san: "Ra8", to: "a8", tag: "Ra8 stalemate", mate: false, stale: true, check: false, threefold: false, gain: 0, hangs: false, piece: "r" }
];
const play = capMoves(noMate, 8);
if (play.sent.some((m) => m.stale)) throw new Error("stalemate not dropped");
if (play.sent[0].lan !== "a2a3") throw new Error("quiet kept over stalemate");

if (formatTag({ san: "exd5", gain: 1, hangs: false }) !== "exd5 +1") throw new Error("tag gain");
if (formatTag({ san: "Qh8#", mate: true, check: true, gain: 0 }) !== "Qh8# mate") throw new Error("tag mate");

const queenEnding = new Chess("8/8/8/5k2/8/2Q5/8/K7 w - - 0 1");
const rookEnding = new Chess("8/8/8/4k3/8/2R5/8/K7 w - - 0 1");
const blackEnding = new Chess("7k/8/5q2/8/2K5/8/8/8 b - - 0 1");
assert.deepEqual(classifyPosition(new Chess()), { phase: "opening", ending: null });
assert.deepEqual(classifyPosition(queenEnding), { phase: "end", ending: "KQK" });
assert.deepEqual(classifyPosition(rookEnding), { phase: "end", ending: "KRK" });
assert.deepEqual(classifyPosition(blackEnding), { phase: "end", ending: "KQK" });
assert.deepEqual(classifyPosition(new Chess("8/8/8/5k2/8/2QP4/8/K7 w - - 0 1")), { phase: "end", ending: null });
assert.equal(classifyPosition(new Chess(new Chess().fen().replace(/ 1$/, " 25"))).phase, "middle");

for (const game of [queenEnding, rookEnding, blackEnding]) {
  const before = game.fen();
  const notes = analyzePosition(game);
  assert.equal(game.fen(), before, "analysis must restore FEN");
  assert.equal(game.history().length, 0, "analysis must restore history");
  assert(notes.some((n) => n.futile && n.check), "fixture must contain a futile check");
  assert(notes.some((n) => n.constructive && !n.check), "fixture must contain quiet constructive play");
  const capped = capMoves(notes, 1);
  assert.equal(capped.legal, game.moves().length, "legal count is before pruning");
  assert(!capped.ranked.some((n) => n.futile), "drop futile checks when safe progress exists");
  assert(capped.sent[0].constructive && !capped.sent[0].check, "cap 1 must preserve quiet box progress");
  const futile = notes.find((n) => n.futile);
  assert.deepEqual(capMoves([futile], "all").sent, [futile], "keep legal fallback when no constructive option exists");
}
const rookNotes = analyzePosition(rookEnding);
const rc4 = rookNotes.find((n) => n.lan === "c3c4");
assert.equal(rc4.boxBefore, 25, "rook divides board into a 5 by 5 region");
assert.equal(rc4.boxAfter, 20, "Rc4 shrinks region to 5 by 4");
assert.equal(rc4.flights, 5);
assert.equal(rc4.kingDistance, 4);
const kb2 = rookNotes.find((n) => n.lan === "a1b2");
assert.equal(kb2.kingApproach, 1);
assert(kb2.constructive && kb2.tag.includes("kingCloser"));
const exposedRook = analyzePosition(new Chess("8/8/8/5k2/4R3/8/8/K7 w - - 0 1"));
const abandonRook = exposedRook.find((n) => n.lan === "a1b2");
assert(abandonRook.kingApproach > 0 && abandonRook.hangs && !abandonRook.constructive, "king approach must not abandon a capturable rook");

const opening = new Chess();
for (const san of ["e4", "e5", "Qh5", "Nc6"]) opening.move(san);
const openingFen = opening.fen(), openingHistory = opening.history();
const openingNotes = analyzePosition(opening);
const queenCheck = openingNotes.find((n) => n.lan === "h5e5");
assert(queenCheck.check && queenCheck.hangs && queenCheck.earlyQ, "Qxe5+ hangs to Nc6");
assert(openingNotes.find((n) => n.lan === "g1f3").develop, "Nf3 develops a home knight");
assert(!capMoves(openingNotes, "all").sent.some((n) => n.earlyQ && n.check && n.hangs));
assert(capMoves(openingNotes, 1).sent[0].develop, "development precedes the queen chase");
assert.deepEqual(capMoves([queenCheck], 1).sent, [queenCheck], "queen-check fallback must remain legal");
assert.equal(opening.fen(), openingFen);
assert.deepEqual(opening.history(), openingHistory);

const castleGame = new Chess();
for (const san of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"]) castleGame.move(san);
assert(analyzePosition(castleGame).find((n) => n.lan === "e1g1").castle, "castling tag");

const finish = new Chess("k7/8/1QK5/8/8/8/8/8 w - - 0 1");
const finishNotes = analyzePosition(finish);
const mating = capMoves(finishNotes, "all");
assert(mating.sent.length > 0 && mating.sent.every((n) => n.mate), "real checkmates are exclusive");
assert(mating.sent.some((n) => n.lan === "b6b7"), "Qb7 is mate");
const stale = finishNotes.find((n) => n.stale);
assert(stale, "fixture must offer stalemate");
const withoutMates = finishNotes.filter((n) => !n.mate);
assert(!capMoves(withoutMates, "all").sent.some((n) => n.stale), "real stalemates are pruned");
assert.deepEqual(capMoves([stale], 1).sent, [stale], "never empty an all-stalemate legal pool");

const repeat = new Chess();
for (const san of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1"]) repeat.move(san);
const repeatHistory = repeat.history();
const repeatedNotes = analyzePosition(repeat);
assert(repeatedNotes.find((n) => n.lan === "f6g8").threefold);
assert(!capMoves(repeatedNotes, "all").sent.some((n) => n.threefold), "repetition is dropped even when material is equal");
assert.deepEqual(capMoves(repeatedNotes.filter((n) => n.threefold), 1).sent.length, 1, "all-repeat pool stays legal");
assert.deepEqual(repeat.history(), repeatHistory, "repetition analysis preserves history");

const fiftyPool = [
  { lan: "a2a3", san: "a3", to: "a3", tag: "a3", mate: false, stale: false, check: false, threefold: false, fifty: false, gain: 0, hangs: false, piece: "p" },
  { lan: "h2h3", san: "h3", to: "h3", tag: "h3 fifty", mate: false, stale: false, check: false, threefold: false, fifty: true, gain: 0, hangs: false, piece: "p" }
];
assert(!capMoves(fiftyPool, 8).sent.some((m) => m.fifty));
assert.deepEqual(capMoves(fiftyPool.filter((m) => m.fifty), 1).sent[0].lan, "h2h3");

const afterCenter = new Chess();
for (const san of ["e4", "e5", "d4", "d5"]) afterCenter.move(san);
const quietChecks = analyzePosition(afterCenter);
const bb5 = quietChecks.find((n) => n.san === "Bb5+");
assert(bb5, "Bb5+ is legal");
assert.equal(bb5.check, true);
assert.equal(bb5.gain, 0);
assert.equal(bb5.futile, true, "Bb5+ does not win material or box");
assert(!capMoves(quietChecks, "all").sent.some((n) => n.futile), "quiet checks are not offered when a real move exists");
assert(capMoves(quietChecks, 1).sent[0].gain > 0, "captures outrank a quiet check");

const material = new Chess();
assert.deepEqual(materialAdvantage(material), { white: 0, black: 0, net: 0 });
for (const san of ["e4", "d5", "exd5"]) material.move(san);
assert.deepEqual(materialAdvantage(material), { white: 1, black: 0, net: 1 });
material.move("Qxd5");
assert.deepEqual(materialAdvantage(material), { white: 0, black: 0, net: 0 });
assert.deepEqual(materialAdvantage(blackEnding), { white: 0, black: 9, net: -9 });
const promotion = new Chess("1k6/P7/8/8/8/8/8/7K w - - 0 1");
assert.equal(materialNet(promotion), 1);
promotion.move("a8=Q+");
assert.deepEqual(materialAdvantage(promotion), { white: 9, black: 0, net: 9 });

for (const compact of [true, false]) {
  const payload = buildMoveQuestions(opening, { cap: "all", compact, instructions: DEFAULT_WHITE, analyst: true });
  assert.deepEqual(Object.keys(payload.state).sort(), ["ending", "fen", "last", "phase", "stm"]);
  assert.equal(payload.state.last, "Nc6");
  assert.equal(payload.state.phase, "opening");
  for (const criterion of Object.values(payload.questions.move.criteria)) {
    if (!compact) assert.deepEqual(Object.keys(criterion).sort(), ["gain", "hangs", "san", "tag"]);
  }
  const wire = JSON.stringify({ state: payload.state, questions: payload.questions });
  assert(!/"(?:cp|best|pv|class|accuracy|captures|net|san_history)"\s*:/.test(wire), "operator review must never enter Jev payload");
}
assert.equal(capMoves(openingNotes, 0).sent.length, 1, "nonempty legal pool survives invalid cap");
assert.equal(capMoves([], 10).sent.length, 0, "game-over pool stays empty");

console.log("chess-lab: real chess.js rules, ranking, state firewall and material checks passed");
