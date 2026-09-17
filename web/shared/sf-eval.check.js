// Run: node web/shared/sf-eval.check.js
// Include a real WASM/UCI smoke test: node web/shared/sf-eval.check.js --engine
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import {
  StockfishEvaluator, classifyMove, summarizeMoves, evaluationCp,
  CP_CAP, SF_BOOT_TIMEOUT_MS, SF_SEARCH_TIMEOUT_MS
} from './sf-eval.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const score = (cp, best = null) => ({ cp, mate: null, best, depth: 10 });
const quality = (loss, side = 'w') => classifyMove(score(0), score(side === 'w' ? -loss : loss), side, 'a2a3');

assert.deepEqual(classifyMove(score(20, 'e2e4'), score(-10), 'w', 'e2e4'), { label: 'Best', glyph: '!', loss: 0 });
assert.equal(quality(-50).loss, 0, 'a deeper search improvement cannot create negative loss');
for (const [loss, label, glyph] of [
  [0, 'Excellent', '!'], [25, 'Excellent', '!'], [26, 'Good', '!'], [50, 'Good', '!'],
  [51, 'Inaccuracy', '?!'], [100, 'Inaccuracy', '?!'], [101, 'Mistake', '?'],
  [200, 'Mistake', '?'], [201, 'Blunder', '??']
]) {
  assert.deepEqual(quality(loss), { label, glyph, loss });
  assert.deepEqual(quality(loss, 'b'), { label, glyph, loss }, 'Black loss uses the mover perspective');
}
assert.equal(classifyMove(score(1500), score(1100), 'w', '').loss, 0, 'extreme evaluations are capped before loss');
assert.equal(classifyMove(score(1000), score(-1000), 'w', '').loss, CP_CAP, 'per-move loss is also capped');
assert.equal(classifyMove(null, score(0), 'w', ''), null);
assert.equal(classifyMove(score(0), { cp: null, mate: null }, 'b', ''), null);
assert.equal(evaluationCp({ mate: 0 }), CP_CAP);
assert.equal(evaluationCp({ mate: -0 }), -CP_CAP);
assert.equal(evaluationCp({ mate: -3 }), -CP_CAP);
assert.equal(evaluationCp({ cp: null, mate: null }), null);

const summary = summarizeMoves([
  { side: 'w', quality: quality(100) }, { side: 'w', quality: quality(200) },
  { side: 'w', quality: null }, { side: 'b', quality: quality(300, 'b') },
  { side: 'b', quality: quality(0, 'b') }
]);
assert.deepEqual(summary.w, { acpl: 150, accuracy: 25, inaccuracies: 1, mistakes: 1, blunders: 0, count: 2 });
assert.deepEqual(summary.b, { acpl: 150, accuracy: 25, inaccuracies: 0, mistakes: 0, blunders: 1, count: 2 });
assert.deepEqual(summarizeMoves([]).w, { acpl: null, accuracy: null, inaccuracies: 0, mistakes: 0, blunders: 0, count: 0 });
assert.equal(summarizeMoves([{ side: 'w', quality: quality(800) }]).w.accuracy, 0);

class FakeWorker {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.commands = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  postMessage(command) { this.commands.push(command); }
  terminate() { this.terminated = true; }
  emit(data) { this.listeners.message({ data }); }
  ready() { this.emit('uciok\nreadyok'); }
  get searches() { return this.commands.filter(command => command.startsWith('go ')); }
}

const originalWorker = globalThis.Worker;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const timers = new Map();
let timerId = 0;
globalThis.Worker = FakeWorker;
globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
function expire(delay) {
  const match = [...timers.values()].find(timer => timer.delay === delay);
  assert.ok(match, `expected a ${delay}ms timeout`);
  match.callback();
}

try {
  const statuses = [];
  const engine = new StockfishEvaluator({ onStatus: status => statuses.push(status.state) });
  const first = engine.evaluate(START), second = engine.evaluate(BLACK);
  let worker = FakeWorker.instances.at(-1);
  assert.match(worker.url.href, /vendor\/stockfish\/stockfish-18-lite-single\.js$/);
  assert.deepEqual(worker.commands, ['uci'], 'positions must wait for UCI and readiness');
  worker.ready();
  assert.equal(worker.searches.length, 1, 'queued positions search one at a time');
  worker.emit('info depth 9 score cp 12\ninfo depth 10 score cp 22\ninfo depth 10 score cp 99 lowerbound\ninfo depth 10 multipv 2 score cp 800\nbestmove e2e4');
  assert.deepEqual(await first, { cp: 22, mate: null, best: 'e2e4', depth: 10 });
  assert.equal(worker.searches.length, 2);
  worker.emit('info depth 10 score cp 35\nbestmove c7c5 ponder g1f3');
  assert.deepEqual(await second, { cp: -35, mate: null, best: 'c7c5', depth: 10 }, 'Black UCI scores normalize to White');
  assert.ok(statuses.includes('loading') && statuses.includes('analyzing') && statuses.at(-1) === 'ready');

  const mate = engine.evaluate(BLACK);
  worker.emit('info depth 10 score mate 3\nbestmove d8h4');
  assert.equal((await mate).mate, -3);
  const matedWhite = engine.evaluate(START);
  worker.emit('info depth 0 score mate 0\nbestmove (none)');
  const whiteResult = await matedWhite;
  assert.ok(Object.is(whiteResult.mate, -0));
  assert.equal(whiteResult.best, null);
  const matedBlack = engine.evaluate(BLACK);
  worker.emit('info depth 0 score mate 0\nbestmove (none)');
  assert.ok(Object.is((await matedBlack).mate, 0));

  const cancelled = Promise.allSettled([engine.evaluate(START), engine.evaluate(BLACK)]);
  engine.reset();
  assert.ok(worker.terminated);
  for (const item of await cancelled) assert.equal(item.reason.name, 'AbortError');
  const fresh = engine.evaluate(START);
  const freshWorker = FakeWorker.instances.at(-1);
  worker.emit('info depth 10 score cp 999\nbestmove a2a3');
  assert.equal(freshWorker.searches.length, 0, 'old-worker output cannot finish a new request');
  freshWorker.ready();
  freshWorker.emit('info depth 10 score cp 30\nbestmove d2d4');
  assert.equal((await fresh).cp, 30);
  worker = freshWorker;

  const timeout = Promise.allSettled([engine.evaluate(START), engine.evaluate(BLACK)]);
  expire(SF_SEARCH_TIMEOUT_MS);
  for (const item of await timeout) assert.match(item.reason.message, /timed out/);
  assert.ok(worker.terminated);
  const existingWorkers = FakeWorker.instances.length;
  await assert.rejects(engine.evaluate(START), /timed out/);
  assert.equal(FakeWorker.instances.length, existingWorkers, 'failed engines do not reload on every ply');

  engine.reset();
  const bootTimeout = assert.rejects(engine.evaluate(START), /finish loading/);
  expire(SF_BOOT_TIMEOUT_MS);
  await bootTimeout;
  engine.reset();
  const failedLoad = assert.rejects(engine.evaluate(START), /download failed/);
  FakeWorker.instances.at(-1).listeners.error({ message: 'download failed' });
  await failedLoad;

  engine.reset();
  const bootCancel = assert.rejects(engine.evaluate(START), { name: 'AbortError' });
  engine.reset();
  await bootCancel;
  await assert.rejects(engine.evaluate(`${START}\ngo infinite`), /valid chess.js FEN/);
  engine.destroy();
  await assert.rejects(engine.evaluate(START), { name: 'AbortError' });
  assert.equal(timers.size, 0, 'reset, failures and destroy clear every deadline');
} finally {
  globalThis.Worker = originalWorker;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}

// Test-only transport: run the exact same vendored WASM on Node and feed its
// UCI output to the browser adapter. The application never uses this transport.
if (process.argv.includes('--engine')) {
  class SmokeWorker {
    constructor(url) {
      this.listeners = {};
      this.errors = '';
      this.terminated = false;
      this.child = spawn(process.execPath, [fileURLToPath(url)], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      createInterface({ input: this.child.stdout }).on('line', data => this.listeners.message?.({ data }));
      this.child.on('error', error => this.listeners.error?.({ message: error.message }));
      this.child.stderr.on('data', data => { this.errors = (this.errors + data).slice(-1000); });
      this.child.on('exit', code => {
        if (!this.terminated) this.listeners.error?.({ message: `WASM smoke process exited (${code}): ${this.errors}` });
      });
    }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    postMessage(command) { this.child.stdin.write(`${command}\n`); }
    terminate() { this.terminated = true; this.child.kill(); }
  }
  globalThis.Worker = SmokeWorker;
  const engine = new StockfishEvaluator();
  try {
    const [opening, mate, stalemate] = await Promise.all([
      engine.evaluate(START),
      engine.evaluate('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'),
      engine.evaluate('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    ]);
    assert.ok(Number.isFinite(opening.cp));
    assert.ok(opening.depth > 0 && opening.depth <= 10);
    assert.match(opening.best, /^[a-h][1-8][a-h][1-8][nbrq]?$/);
    assert.ok(Object.is(mate.mate, 0), 'terminal Black checkmate is a White win');
    assert.equal(mate.best, null);
    assert.equal(stalemate.cp, 0);
    assert.equal(stalemate.best, null);
    console.log('Stockfish WASM smoke:', JSON.stringify({ opening, mate, stalemate }));
  } finally {
    engine.destroy();
    globalThis.Worker = originalWorker;
  }
}
console.log('Stockfish review checks passed');
