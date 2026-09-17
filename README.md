# Jev Broadcast Lab

Operator lab for TypeSafe Jev (System One). Chess Arena is the main booth. The rest of the site reuses the same client, the same chrome, and the same closed schema.

This is not a chess engine and not a chatbot. chess.js owns legality. Jev only picks among a closed LAN list and returns Choice, Score, and Noul. Stockfish runs in the browser for the operator HUD. Engine scores never go into Jev's payload.

## Acknowledgment

We applied to the TypeSafe Jev waitlist and were accepted. Thank you to the TypeSafe team for the access, the documentation, and the Choice / Score / Noul contract. This repository is an independent lab. It is not an official TypeSafe product.

Docs: [docs.typesafe.ai](https://docs.typesafe.ai/)

## What lives where

| Piece | Role |
| --- | --- |
| TypeSafe Jev | Closed-set judgment (`jev-latest` via `POST /v1/systemone`) |
| chess.js | Legal moves, FEN, SAN, LAN |
| Stockfish.js 18 lite WASM | Operator review only. Depth 10, 2s ceiling. White-pov CP |
| `server.py` | Serves `web/` and holds `TYPESAFE_API_KEY` |
| GitHub Pages | Static UI. No API key in the bundle |
| `proxy/worker.js` | Optional Cloudflare Worker that holds the key |

Jev sees compact state: `fen`, `stm`, `last`, `phase`, `ending`, plus move tags. It does not see Stockfish CP, best move, PV, accuracy, or captures.

## Run locally

You need Python 3 and a TypeSafe API key.

```bash
copy .env.example .env   # Windows
# cp .env.example .env  # macOS / Linux
```

Set `TYPESAFE_API_KEY` in `.env`. Then:

```bash
python server.py
```

Open http://127.0.0.1:8787/

`.env` is gitignored. Do not commit it. Do not put the key in `web/`.

## GitHub Pages and the API key

GitHub Pages is a static host. Anything in the published `web/` folder is public. Putting `TYPESAFE_API_KEY` in the site, in a Pages build, or in a committed `config.json` would leak it. The key stays in `.env` on your machine and, for the public site, in GitHub Actions secrets. It never ships in JavaScript.

Local live Jev: `python server.py` with `.env`. That is the supported operator path.

There is no way to use the TypeSafe key on the public site without storing it somewhere you control. If it is in JavaScript, anyone can copy it. If the browser never sees it, a server (this proxy, or `server.py`) must hold it and attach it.

Public live Jev uses that proxy:

1. Create a free Cloudflare account.
2. Add repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `TYPESAFE_API_KEY`.
3. Run the `proxy` workflow. It deploys `proxy/worker.js`.
4. Copy the worker URL (example: `https://jev-broadcast-lab.<subdomain>.workers.dev`) into repo secret `JEV_PROXY_URL`.
5. Re-run the `pages` workflow. The published site then calls the proxy. The browser never sees the TypeSafe key.

Other websites cannot call Jev in a browser. The proxy checks Origin, `Sec-Fetch-Site`, and an HttpOnly cookie issued only to this lab. A script that fakes those headers can still spend quota. Rate limit is 40 calls per IP per minute. Cloudflare Access is the next step if that is not enough.

If you host `server.py` yourself instead, set `CORS_ORIGINS=https://4anti.github.io` and use that host as `JEV_PROXY_URL`.

Paste-a-key in the rack remains for visitors who bring their own TypeSafe key. Direct browser calls to `api.typesafe.ai` may fail CORS.

## Arena

Human vs Jev, or Jev vs Jev. The instruction box is a short Choice label. It does not teach chess. Filters do:

- mates only, if any exist
- drop stalemate, threefold, and fifty-move when a real LAN exists
- drop quiet checks unless they mate, win material, or tighten a KQK / KRK box

That is a one-ply heuristic, not a forced-mate solver. Rich payload mode expands move tags, not the board state.

Material strips are local. They show missing opposing pieces versus a standard start, queens first. Custom FENs and promotions can differ from capture history. Replay updates material and the eval graph together.

### Operator review

On by default. Bundled Stockfish WASM, depth 10, two-second search ceiling. Play does not wait for analysis. Off stops the worker. On again backfills unrated positions. New match clears ratings.

Move labels are local CP-loss buckets: Best is the engine's preferred move; otherwise Excellent ≤25, Good ≤50, Inaccuracy ≤100, Mistake ≤200, Blunder >200. Losses are capped at 1,000 centipawns. Estimated accuracy is `max(0, 100 - 0.5 × ACPL)`, not Chess.com's formula. Unrated plies are omitted. Each plate shows how many plies are rated.

Engine provenance and GPL: [web/vendor/stockfish/README.md](web/vendor/stockfish/README.md).

### Jev score

Stored in this browser. Finished games add White wins, Black wins, draws, and Jev W-D-L against a human. Jev vs Jev updates color wins only. Strength uses Jev plies only.

Elo is interpolated from community ACPL bands (100 ACPL ≈ 1000, 220 ACPL ≈ 200) after scaling depth-10 loss by `sqrt(18/10)`. Stockfish `UCI_Elo` starts at 1320. Below that the plate says below Stockfish. Not FIDE. Abandoned matches do not count. Reset score clears local totals. None of this is sent to Jev.

## Booths

| Route | Booth |
| --- | --- |
| `/` | Home |
| `/arena/` | Chess Arena |
| `/lab/router/` | Desk Router |
| `/lab/guard/` | Outbound Guard |
| `/lab/rank/` | Ranker / Semantic Find |
| `/lab/mod/` | Moderator |
| `/lab/call/` | Function caller |
| `/lab/pgn/` | PGN studio |
| `/lab/loop/` | Doom-style loop |
| `/deck/` | Pitch deck (`presentation.html` also works as a local file) |

## Checks

```bash
npm ci
npm test
npm run test:engine
npx playwright install chromium
# python server.py in another terminal:
npm run test:browser
```

Browser checks use real Stockfish and intercept Jev requests. They do not spend API credits.

## Docker

```bash
docker build -t jev-lab .
docker run --rm -p 8787:8787 -e TYPESAFE_API_KEY jev-lab
```

Pass the key from your environment. Do not bake it into the image.

## License notes

Lab code in this repository is provided as-is for operators with TypeSafe access.

The Stockfish.js worker under `web/vendor/stockfish/` is GPL-3.0. Keep the license, AUTHORS, and corresponding-source links when you copy those files.
