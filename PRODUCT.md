# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML/CSS/JS under `web/`, Python stdlib proxy (`server.py`), Dockerfile for later host deploy. Chosen because the user asked to pick the best GitHub-ready stack: the repo can be public; `TYPESAFE_API_KEY` never ships in the frontend; GitHub Pages is not a runtime (no secrets). Local: `python server.py` on `127.0.0.1:8787`. Later: one container with the key as a host secret.

## Users

Primary: the operator of this lab (currently a single developer) sitting at a desktop, exploring TypeSafe Jev by running live judgments. Job: see Choice, Score, and Noul under load, including two Jevs playing chess, then reuse the same client in other booths.

Secondary (inferred from “ship this later to GitHub”): someone who clones the repo, puts their own TypeSafe key in `.env`, and runs or deploys the same lab. Not a consumer chess audience.

## Product Purpose

Jev Broadcast Lab is a local (then deployable) playground for TypeSafe System One. Chess Arena is the flagship booth, not the product. Success is: a visitor can watch or play a match, change pace and candidate cap, and run the other booths, all against the same `POST /v1/systemone` proxy, without putting the API key in the page when `.env` is set.

## Positioning

Jev is not a chatbot and not a chess engine. Legal moves come from chess.js. Jev only picks among a closed LAN set and returns probabilities. Neighboring products that generate commentary, eval bars, or Stockfish lines cannot truthfully copy that split.

## Operating Context

- TypeSafe early-access API: `https://api.typesafe.ai/v1/systemone`, model alias `jev-latest`.
- Browser talks only to the same-origin proxy. Direct browser calls to TypeSafe fail CORS from `file://` and unlisted origins.
- Workflow: start server, open `http://127.0.0.1:8787`, pick a booth, watch HUD (tokens, ms, confidence).
- Ritual: Jev vs Jev is a spectator match with a pace delay after each ply.

## Capabilities and Constraints

Confirmed capabilities:

- Human vs Jev and Jev vs Jev on a chess.js board (gchessboard).
- Compact Choice payloads (FEN + LAN keys), candidate cap ≤ 255, spectator pace slider.
- Lab pages: Ticket desk, Safety filter, Document find, Chat mod, Chat emotion, Debate move, Cheating or not, Tool call, PGN puzzles, Grid turns.
- Server-side key from `TYPESAFE_API_KEY` / `.env`. Paste-in-UI key is local-dev fallback only.

Constraints:

- Jev returns Choice, Score, Noul only. No free-text generation, no images, no OpenAI-compatible chat routes.
- Choice lists cap at 255 options. Positions or docs above that must truncate in code and show counts.
- Calibration is not per-answer truth. HUD must not label Jev probabilities as engine eval or accuracy.
- Independent questions in one request cannot see each other’s answers.
- Do not invent customers, prices, or “Jev is Stockfish”.

Undecided: production host (Fly / Railway / VPS), whether paste-in-UI remains after first public deploy.

## Brand Commitments

- Product name: **Jev Broadcast Lab** (working title from the locked plan).
- Visual pin (user): esports **broadcast** HUD. Dense, high contrast, move ticks, spectator energy. Explicit bans: walnut chess-club, purple SaaS gradient.
- Voice: operator language. Controls name the action. Never claim Jev “thinks” in prose it did not write.
- Honest labels: “Jev mass” for probabilities, not win%.

## Evidence on Hand

- Working proxy and chess demo in this repo (`server.py`, original `index.html` as the incumbent to replace).
- TypeSafe public docs: https://docs.typesafe.ai/
- No customer logos, testimonials, or independent accuracy leaderboard. Future surfaces must not fabricate them.

## Product Principles

1. Code owns legality, math, and thresholds; Jev owns closed-set judgment.
2. The key never lives in git or in a public static host.
3. Speed has two knobs: input-token compactness (real latency) and spectator pace (display delay).
4. Every booth reuses one client and one broadcast chrome.
5. HUD tells the truth about what Jev returned.

## Accessibility & Inclusion

Keyboard: history scrubber (arrows), pause (Space) in Jev vs Jev. Contrast must hold on the dark broadcast field. No product-specific assistive-tech research was collected.
