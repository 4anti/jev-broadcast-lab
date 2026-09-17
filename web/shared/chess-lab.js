const CENTER = new Set(["d4", "e4", "d5", "e5"]);
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const DEFAULT_WHITE = "Pick a LAN.";
export const DEFAULT_BLACK = DEFAULT_WHITE;

export function materialNet(game) {
  let n = 0;
  for (const row of game.board()) {
    for (const p of row) {
      if (!p) continue;
      n += (p.color === "w" ? 1 : -1) * (VAL[p.type] || 0);
    }
  }
  return n;
}

export function materialAdvantage(game) {
  const net = materialNet(game);
  return { white: Math.max(0, net), black: Math.max(0, -net), net };
}

function piecesOnBoard(game) {
  return game.board().flatMap((row, r) => row.flatMap((p, x) => p ? [{ ...p, x, y: 7 - r }] : []));
}

function positionKind(game, pieces) {
  const extra = pieces.filter((p) => p.type !== "k");
  const heavy = extra.length === 1 && ["q", "r"].includes(extra[0].type) ? extra[0] : null;
  const ending = heavy ? (heavy.type === "q" ? "KQK" : "KRK") : null;
  const nonPawn = extra.reduce((sum, p) => sum + (p.type === "p" ? 0 : VAL[p.type]), 0);
  const queens = extra.filter((p) => p.type === "q").length;
  const fullmove = Number(game.fen().split(" ")[5]);
  // A transparent material/age heuristic, not an opening book or engine phase.
  const phase = ending || nonPawn <= 13 || (!queens && nonPawn <= 20)
    ? "end" : fullmove <= 12 && nonPawn >= 40 ? "opening" : "middle";
  return { phase, ending, stronger: heavy?.color || null };
}

export function classifyPosition(game) {
  const { phase, ending } = positionKind(game, piecesOnBoard(game));
  return { phase, ending };
}

const inside = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
const distance = (a, b) => a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : null;

function attacked(pieces, x, y, color) {
  return pieces.some((p) => {
    if (p.color !== color) return false;
    const dx = x - p.x, dy = y - p.y;
    if (p.type === "p") return Math.abs(dx) === 1 && dy === (color === "w" ? 1 : -1);
    if (p.type === "n") return Math.abs(dx) * Math.abs(dy) === 2;
    if (p.type === "k") return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    const straight = (dx === 0) !== (dy === 0);
    const diagonal = dx !== 0 && Math.abs(dx) === Math.abs(dy);
    if (!(p.type === "q" && (straight || diagonal) || p.type === "r" && straight || p.type === "b" && diagonal)) return false;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    for (let cx = p.x + sx, cy = p.y + sy; cx !== x || cy !== y; cx += sx, cy += sy) {
      if (pieces.some((q) => q.x === cx && q.y === cy)) return false;
    }
    return true;
  });
}

function kingFlights(pieces, color) {
  const king = pieces.find((p) => p.type === "k" && p.color === color);
  if (!king) return 0;
  const enemy = color === "w" ? "b" : "w";
  let flights = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const x = king.x + dx, y = king.y + dy;
    if (!inside(x, y) || pieces.some((p) => p.x === x && p.y === y && (p.color === color || p.type === "k"))) continue;
    // Remove the king's old square and a potential capture to catch discovered rays.
    const occupancy = pieces.filter((p) => p !== king && !(p.x === x && p.y === y));
    if (!attacked(occupancy, x, y, enemy)) flights++;
  }
  return flights;
}

function kingBox(pieces, defender) {
  const king = pieces.find((p) => p.type === "k" && p.color === defender);
  if (!king) return 64;
  const attackers = pieces.filter((p) => p !== king);
  const strong = defender === "w" ? "b" : "w";
  const safe = new Set();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (!attackers.some((p) => p.x === x && p.y === y) && !attacked(attackers, x, y, strong)) safe.add(y * 8 + x);
  }
  // Flood the king's reachable safe region with the other pieces held fixed.
  // Include its current square even in check, joining all possible escape regions.
  // This is geometric confinement, not a search or proof of a forced mate.
  const queue = [king.y * 8 + king.x];
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i] % 8, y = Math.floor(queue[i] / 8);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx, ny = y + dy, id = ny * 8 + nx;
      if (inside(nx, ny) && safe.has(id) && !seen.has(id)) { seen.add(id); queue.push(id); }
    }
  }
  return seen.size;
}

function positionFacts(game) {
  const pieces = piecesOnBoard(game);
  const kind = positionKind(game, pieces);
  const own = pieces.find((p) => p.type === "k" && p.color === game.turn());
  const enemy = pieces.find((p) => p.type === "k" && p.color !== game.turn());
  const boxing = kind.ending && kind.stronger === game.turn();
  return {
    ...kind, pieces, boxing, kingDistance: distance(own, enemy),
    flights: kingFlights(pieces, game.turn() === "w" ? "b" : "w"),
    box: boxing ? kingBox(pieces, enemy.color) : null,
    undeveloped: pieces.filter((p) => p.color === game.turn() && ["n", "b"].includes(p.type) && p.y === (p.color === "w" ? 0 : 7)).length
  };
}

export function formatTag(n) {
  const bits = [n.san || n.lan];
  if (n.mate) bits.push("mate");
  else if (n.stale) bits.push("stalemate");
  if (n.threefold) bits.push("threefold");
  if (n.fifty) bits.push("fifty");
  if (n.gain > 0) bits.push("+" + n.gain);
  else if (n.gain < 0) bits.push(String(n.gain));
  if (n.check && !n.mate) bits.push("check");
  if (n.hangs) bits.push("hangs");
  if (Number.isFinite(n.flights)) bits.push("flights:" + n.flights);
  if (Number.isFinite(n.kingDistance)) bits.push("kingDist:" + n.kingDistance);
  if (Number.isFinite(n.boxAfter)) bits.push("box:" + n.boxBefore + ">" + n.boxAfter);
  if (n.kingApproach > 0) bits.push("kingCloser");
  if (n.futile) bits.push("futile");
  if (n.develop) bits.push("develop");
  if (n.castle) bits.push("castle");
  if (n.earlyQ) bits.push("earlyQ");
  return bits.join(" ");
}

export function tagMove(game, m, facts = positionFacts(game)) {
  const stm = game.turn();
  const before = materialNet(game);
  let played = null;
  try {
    played = game.move({ from: m.from, to: m.to, promotion: m.promotion });
  } catch (_) {
    played = null;
  }
  if (!played) {
    return { ...m, tag: m.san || m.lan, mate: false, stale: false, check: false, threefold: false, fifty: false, gain: 0, hangs: false };
  }
  try {
    const gain = (stm === "w" ? 1 : -1) * (materialNet(game) - before);
    const pieces = piecesOnBoard(game);
    const replies = game.moves({ verbose: true });
    const kings = pieces.filter((p) => p.type === "k");
    const kingDistance = distance(kings[0], kings[1]);
    const boxAfter = facts.boxing ? kingBox(pieces, game.turn()) : null;
    const note = {
      ...m,
      san: played.san,
      lan: played.lan || m.lan,
      from: played.from,
      to: played.to,
      promotion: played.promotion,
      piece: played.piece,
      captured: played.captured,
      mate: game.isCheckmate(),
      stale: game.isStalemate(),
      check: game.inCheck(),
      threefold: typeof game.isThreefoldRepetition === "function" && game.isThreefoldRepetition(),
      fifty: typeof game.isDrawByFiftyMoves === "function" && game.isDrawByFiftyMoves(),
      gain,
      hangs: replies.some((x) => x.to === played.to && x.captured),
      phase: facts.phase,
      ending: facts.ending,
      flights: replies.filter((x) => x.piece === "k" && !String(x.flags).match(/[kq]/)).length,
      flightsBefore: facts.flights,
      kingDistance,
      kingApproach: facts.boxing ? facts.kingDistance - kingDistance : 0,
      boxBefore: facts.box,
      boxAfter,
      boxShrink: facts.boxing ? facts.box - boxAfter : 0,
      develop: facts.phase === "opening" && ["n", "b"].includes(played.piece) && played.from[1] === (stm === "w" ? "1" : "8") && played.to[1] !== played.from[1],
      castle: played.piece === "k" && /[kq]/.test(played.flags),
      earlyQ: facts.phase === "opening" && played.piece === "q" && facts.undeveloped >= 2
    };
    const heavyExposed = facts.boxing && replies.some((reply) => ["q", "r"].includes(reply.captured));
    // A king move must not earn a "closer" preference while abandoning its rook/queen.
    if (heavyExposed) note.hangs = true;
    // ponytail: quiet checks are treated as draw-hunting. Capturing checks still pass. Add 2-ply fork detection if that ceiling binds.
    note.futile = Boolean(note.check && !note.mate && note.gain <= 0 && note.boxShrink <= 0 && note.kingApproach <= 0);
    note.constructive = Boolean(facts.boxing && !note.hangs && !note.stale && !note.threefold && !note.fifty && (note.boxShrink > 0 || note.boxShrink === 0 && note.kingApproach > 0));
    note.tag = formatTag(note);
    return note;
  } finally {
    game.undo();
  }
}

export function analyzePosition(game) {
  const facts = positionFacts(game);
  return game.moves({ verbose: true }).map((m) => tagMove(game, m, facts));
}

function scoreNote(n) {
  // Checks stay in the tag. They do not get a rank bonus; that is how perpetuals floated to the top.
  return [n.mate ? 1 : 0, n.stale ? -2 : n.futile ? -1 : 0,
    n.hangs ? -1 : 0, (n.threefold || n.fifty) ? -1 : 0, n.constructive ? 1 : 0,
    Math.max(0, n.boxShrink || 0), Math.max(0, n.kingApproach || 0),
    n.gain || 0, n.castle ? 2 : n.develop ? 1 : 0, n.earlyQ ? -1 : 0,
    CENTER.has(n.to) ? 1 : 0];
}

export function rankMoves(moves) {
  if (moves.length && Object.prototype.hasOwnProperty.call(moves[0], "tag")) {
    return [...moves].sort((a, b) => {
      const as = scoreNote(a), bs = scoreNote(b);
      const i = as.findIndex((s, index) => s !== bs[index]);
      const d = i < 0 ? 0 : bs[i] - as[i];
      return d || String(a.lan).localeCompare(String(b.lan));
    });
  }
  const score = (m) => {
    let s = 0;
    const san = m.san || "";
    if (san.includes("#")) s += 10000;
    if (san.includes("+") || san.includes("#")) s += 4000;
    if (m.promotion) s += 3000;
    const cap = typeof m.isCapture === "function" ? m.isCapture() || m.isEnPassant?.() : Boolean(m.captured);
    if (cap) s += 1000 + (VAL[m.captured] || 0) * 10;
    return s;
  };
  return [...moves].sort((a, b) => {
    const d = score(b) - score(a);
    return d || String(a.lan).localeCompare(String(b.lan));
  });
}

export function capMoves(moves, cap) {
  const tagged = moves.length && Object.prototype.hasOwnProperty.call(moves[0], "tag");
  const mates = tagged ? moves.filter((m) => m.mate) : moves.filter((m) => (m.san || "").includes("#"));
  let pool = mates.length ? mates : moves;
  if (tagged && !mates.length) {
    const play = pool.filter((m) => !m.stale);
    if (play.length) pool = play;
    const noDraw = pool.filter((m) => !m.threefold && !m.fifty);
    if (noDraw.length) pool = noDraw;
    if (pool.some((m) => !m.futile)) pool = pool.filter((m) => !m.futile);
    if (pool.some((m) => (m.develop || m.castle) && !m.hangs && !m.stale && !m.threefold && !m.fifty)) {
      pool = pool.filter((m) => !(m.earlyQ && m.check && m.hangs));
    }
  }
  const ranked = rankMoves(pool);
  const limit = cap === "all" ? 255 : Number(cap);
  const n = Math.min(Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 32)), 255, ranked.length);
  return { ranked, sent: ranked.slice(0, n), legal: moves.length };
}

export function buildMoveQuestions(game, { cap, compact, instructions, analyst }) {
  const notes = analyzePosition(game);
  const { sent, legal } = capMoves(notes, cap);
  const criteria = {};
  for (const m of sent) {
    criteria[m.lan] = compact ? m.tag : { tag: m.tag, san: m.san, gain: m.gain, hangs: m.hangs };
  }
  const questions = {
    move: {
      type: "choice",
      instructions,
      criteria
    }
  };
  if (analyst) {
    questions.plan = {
      type: "choice",
      instructions: "What plan fits this position for the side to move?",
      criteria: {
        attack: "Seek initiative or attack",
        hold: "Consolidate and wait",
        simplify: "Trade toward a safer ending",
        provoke: "Create practical problems"
      }
    };
    questions.quality = {
      type: "score",
      instructions: "How healthy is the side-to-move position?",
      criteria: ["Losing", "Worse", "Equal", "Better", "Winning"]
    };
    questions.sharp = {
      type: "noul",
      instructions: "The position is tactically sharp this move."
    };
  }
  const hist = game.history();
  const state = { fen: game.fen(), stm: game.turn(), last: hist[hist.length - 1] || null, ...classifyPosition(game) };
  return { questions, state, sent, legal, map: new Map(sent.map((m) => [m.lan, m])) };
}

export function resultText(g) {
  if (g.isCheckmate()) return "Checkmate — " + (g.turn() === "w" ? "Black" : "White") + " wins";
  if (g.isStalemate()) return "Draw — stalemate";
  if (g.isThreefoldRepetition()) return "Draw — threefold";
  if (g.isDrawByFiftyMoves()) return "Draw — fifty-move";
  if (g.isInsufficientMaterial()) return "Draw — insufficient material";
  if (g.isDraw()) return "Draw";
  return "Game over";
}
