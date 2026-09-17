// Operator-only review. Never import this module into chess-lab or jev-client.
// UCI scores are normalized to White's point of view at the worker boundary.
export const SF_SEARCH_DEPTH = 10;
export const SF_MOVE_TIME_MS = 2000;
export const SF_BOOT_TIMEOUT_MS = 20000;
export const SF_SEARCH_TIMEOUT_MS = 10000;
export const CP_CAP = 1000;
export const ACCURACY_ACPL_SCALE = 0.5;
export const MOVE_QUALITY_LIMITS = Object.freeze({
  excellent: 25, good: 50, inaccuracy: 100, mistake: 200
});

const ENGINE_URL = new URL('../vendor/stockfish/stockfish-18-lite-single.js', import.meta.url);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Capped White-pov CP for review only. Mate +0/-0 means White/Black has won. */
export function evaluationCp(result) {
  if (!result) return null;
  if (Number.isFinite(result.mate)) {
    return result.mate < 0 || Object.is(result.mate, -0) ? -CP_CAP : CP_CAP;
  }
  return Number.isFinite(result.cp) ? clamp(result.cp, -CP_CAP, CP_CAP) : null;
}

/** Local CP-loss buckets, not Chess.com's proprietary move/accuracy formula. */
export function classifyMove(before, after, side, lan) {
  const previous = evaluationCp(before), next = evaluationCp(after);
  if (previous === null || next === null || !['w', 'b'].includes(side)) return null;
  // Independent depth-limited searches can disagree slightly. A move selected
  // by the pre-move engine search should never be penalized for that noise.
  if (lan && before.best === lan) return { label: 'Best', glyph: '!', loss: 0 };
  const loss = clamp((previous - next) * (side === 'w' ? 1 : -1), 0, CP_CAP);
  const limits = MOVE_QUALITY_LIMITS;
  const label = loss <= limits.excellent ? 'Excellent'
    : loss <= limits.good ? 'Good'
    : loss <= limits.inaccuracy ? 'Inaccuracy'
    : loss <= limits.mistake ? 'Mistake' : 'Blunder';
  const glyph = label === 'Blunder' ? '??' : label === 'Mistake' ? '?'
    : label === 'Inaccuracy' ? '?!' : '!';
  return { label, glyph, loss };
}

/** Approximate accuracy = max(0, 100 - 0.5 × mean capped CP loss). */
export function summarizeMoves(moves) {
  const empty = () => ({ acpl: null, accuracy: null, inaccuracies: 0, mistakes: 0, blunders: 0, count: 0 });
  const result = { w: empty(), b: empty() }, totals = { w: 0, b: 0 };
  for (const move of moves) {
    const row = result[move.side], quality = move.quality;
    if (!row || !quality || !Number.isFinite(quality.loss)) continue;
    row.count++;
    totals[move.side] += clamp(quality.loss, 0, CP_CAP);
    if (quality.label === 'Inaccuracy') row.inaccuracies++;
    if (quality.label === 'Mistake') row.mistakes++;
    if (quality.label === 'Blunder') row.blunders++;
  }
  for (const side of ['w', 'b']) {
    const row = result[side];
    if (!row.count) continue;
    const average = totals[side] / row.count;
    row.acpl = Math.round(average * 10) / 10;
    row.accuracy = Math.round(clamp(100 - ACCURACY_ACPL_SCALE * average, 0, 100) * 10) / 10;
  }
  return result;
}

function abortError() {
  const error = new Error('Stockfish review cancelled');
  error.name = 'AbortError';
  return error;
}

/**
 * A lazy, local, single-threaded WASM worker with one UCI search at a time.
 * evaluate() never blocks play. Consumers must catch rejection, and ignore
 * AbortError when resetting a match or turning off operator review.
 * onStatus receives {state, message}: loading, ready, analyzing, error or off.
 */
export class StockfishEvaluator {
  constructor({ onStatus } = {}) {
    this.onStatus = onStatus;
    this.worker = null;
    this.queue = [];
    this.current = null;
    this.ready = false;
    this.destroyed = false;
    this.failure = null;
    this.timer = null;
  }

  evaluate(fen) {
    if (this.destroyed) return Promise.reject(abortError());
    if (this.failure) return Promise.reject(this.failure);
    // The caller supplies chess.js FEN. Reject control characters so a FEN
    // can never become a second UCI command; chess.js owns position legality.
    if (typeof fen !== 'string' || /[\r\n\0]/.test(fen) ||
        !/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|[KQkq]+) (?:-|[a-h][36]) \d+ [1-9]\d*$/.test(fen)) {
      return Promise.reject(new Error('Stockfish requires a valid chess.js FEN'));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, turn: fen.split(' ')[1], resolve, reject, score: null });
      if (!this.worker) this.start();
      this.pump();
    });
  }

  start() {
    this.status('loading', 'Loading Stockfish');
    try {
      if (typeof Worker !== 'function' || typeof WebAssembly !== 'object') {
        throw new Error('This browser does not support Stockfish WASM workers');
      }
      // Use the unmodified vendor script directly: it locates the adjacent
      // WASM file and embeds its network. No extra NNUE download or isolation.
      const worker = new Worker(ENGINE_URL, { name: 'stockfish-operator-review' });
      this.worker = worker;
      worker.addEventListener('message', event => {
        if (this.worker !== worker || typeof event.data !== 'string') return;
        for (const line of event.data.split(/\r?\n/)) {
          if (this.worker !== worker) break;
          this.receive(line.trim());
        }
      });
      worker.addEventListener('error', event => {
        if (this.worker !== worker) return;
        event.preventDefault?.();
        this.fail(new Error(event.message || 'Stockfish worker failed to load'));
      });
      worker.addEventListener('messageerror', () => {
        if (this.worker === worker) this.fail(new Error('Stockfish worker returned an unreadable message'));
      });
      this.deadline(SF_BOOT_TIMEOUT_MS, 'Stockfish did not finish loading');
      this.send('uci');
    } catch (error) {
      this.fail(error);
    }
  }

  receive(line) {
    if (line === 'uciok' && !this.ready) {
      this.send('setoption name Hash value 16');
      this.send('setoption name MultiPV value 1');
      this.send('ucinewgame');
      this.send('isready');
      return;
    }
    if (line === 'readyok' && !this.ready) {
      clearTimeout(this.timer);
      this.ready = true;
      this.status('ready', 'Stockfish ready');
      this.pump();
      return;
    }
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info ')) {
      const score = /\bscore (cp|mate) (-?\d+)\b/.exec(line);
      const depth = /\bdepth (\d+)\b/.exec(line);
      const multipv = /\bmultipv (\d+)\b/.exec(line);
      if (!score || !depth || (multipv && multipv[1] !== '1') || /\b(?:upperbound|lowerbound)\b/.test(line)) return;
      const amount = Number(score[2]), sign = job.turn === 'w' ? 1 : -1;
      const next = { cp: null, mate: null, best: null, depth: Number(depth[1]) };
      if (score[1] === 'cp') next.cp = amount === 0 ? 0 : amount * sign;
      // UCI mate 0 is the side to move already checkmated. Preserve both the
      // winner and zero distance with signed zero in the White-pov result.
      else next.mate = amount === 0 ? (job.turn === 'w' ? -0 : 0) : amount * sign;
      if (!job.score || next.depth >= job.score.depth) job.score = next;
      return;
    }
    const best = /^bestmove (\S+)/.exec(line);
    if (!best) return;
    clearTimeout(this.timer);
    this.current = null;
    if (job.score) {
      job.score.best = /^[a-h][1-8][a-h][1-8][nbrq]?$/.test(best[1]) ? best[1] : null;
      job.resolve(job.score);
    } else job.reject(new Error('Stockfish returned no evaluation'));
    this.status('ready', 'Stockfish ready');
    this.pump();
  }

  pump() {
    if (!this.ready || !this.worker || this.current || !this.queue.length) return;
    const job = this.queue.shift();
    this.current = job;
    this.status('analyzing', 'Stockfish analyzing');
    this.deadline(SF_SEARCH_TIMEOUT_MS, 'Stockfish analysis timed out');
    this.send(`position fen ${job.fen}`);
    this.send(`go depth ${SF_SEARCH_DEPTH} movetime ${SF_MOVE_TIME_MS}`);
  }

  send(command) {
    try { this.worker?.postMessage(command); }
    catch (error) { this.fail(error); }
  }

  deadline(milliseconds, message) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(new Error(message)), milliseconds);
  }

  status(state, message) {
    // HUD rendering must not interfere with the engine's cancellation/queue.
    try { this.onStatus?.({ state, message }); }
    catch (error) { console.warn('Stockfish status callback failed', error); }
  }

  cancel(error) {
    clearTimeout(this.timer);
    this.timer = null;
    const worker = this.worker;
    this.worker = null;
    this.ready = false;
    // Termination is deliberate: no late bestmove from a prior match can be
    // mistaken for the first result in the new match, even during WASM boot.
    worker?.terminate();
    if (this.current) this.current.reject(error);
    this.current = null;
    for (const job of this.queue.splice(0)) job.reject(error);
  }

  fail(error) {
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.cancel(this.failure);
    this.status('error', this.failure.message);
  }

  reset() {
    this.cancel(abortError());
    this.failure = null;
    this.status('off', 'Stockfish idle');
  }

  destroy() {
    this.destroyed = true;
    this.reset();
  }
}
