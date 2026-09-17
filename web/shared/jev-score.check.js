import assert from "node:assert/strict";
import {
  applyGame, emptyBook, eloFromAcpl, jevSample, jevStrength, loadBook, outcome, saveBook, skillFromElo
} from "./jev-score.js";

assert.equal(eloFromAcpl(NaN), null);
assert.equal(eloFromAcpl(0), 2500);
assert.equal(eloFromAcpl(22, 18), 2000);
assert.equal(eloFromAcpl(100, 18), 1000);
assert.equal(eloFromAcpl(220, 18), 200);
assert.equal(eloFromAcpl(97.5), 728);
assert.equal(skillFromElo(200), null);
assert.equal(skillFromElo(1319), null);
assert.equal(skillFromElo(1320), 0);
assert.equal(skillFromElo(2255), 10);
assert.equal(skillFromElo(3190), 20);
assert.deepEqual(jevStrength({ jevPlies: 2, jevLossSum: 195 }), { acpl: 97.5, accuracy: 51.3, elo: 728, skill: null });
assert.deepEqual(jevStrength({ jevPlies: 0, jevLossSum: 0 }), { acpl: null, accuracy: null, elo: null, skill: null });

assert.equal(outcome({ isGameOver: () => false }), null);
assert.equal(outcome({ isGameOver: () => true, isCheckmate: () => true, turn: () => "w" }), "black");
assert.equal(outcome({ isGameOver: () => true, isCheckmate: () => true, turn: () => "b" }), "white");
assert.equal(outcome({ isGameOver: () => true, isCheckmate: () => false, turn: () => "w" }), "draw");

const sample = jevSample([
  { side: "w", agent: "jev", quality: { loss: 20 } },
  { side: "b", agent: "human", quality: { loss: 400 } },
  { side: "w", agent: "jev", quality: null }
], { w: "jev", b: "human" });
assert.deepEqual(sample, { jevPlies: 1, jevLossSum: 20 });

let book = applyGame(emptyBook(), { result: "white", agents: { w: "jev", b: "human" }, ...sample });
assert.deepEqual(book, { whiteWins: 1, blackWins: 0, draws: 0, jevWins: 1, jevDraws: 0, jevLosses: 0, jevPlies: 1, jevLossSum: 20, jevGames: 1 });
book = applyGame(book, { result: "white", agents: { w: "human", b: "jev" }, jevPlies: 0, jevLossSum: 0 });
assert.equal(book.whiteWins, 2);
assert.equal(book.jevLosses, 1);
book = applyGame(book, { result: "white", agents: { w: "jev", b: "jev" }, jevPlies: 4, jevLossSum: 80 });
assert.equal(book.jevWins, 1, "self-play does not add Jev W-D-L");
assert.equal(book.jevPlies, 5);
assert.equal(applyGame(book, { result: null, agents: { w: "jev", b: "human" }, jevPlies: 9, jevLossSum: 9 }), book);

const memory = { store: null, getItem() { return this.store; }, setItem(_, value) { this.store = value; } };
saveBook(book, memory);
assert.deepEqual(loadBook(memory).jevGames, 3);
assert.deepEqual(loadBook({ getItem: () => "{not json" }), emptyBook());

console.log("Jev career score checks passed");
