# Stockfish browser engine

Unmodified **Stockfish.js 18.0.8**, lite single-threaded WASM build from the
[`stockfish` npm package](https://www.npmjs.com/package/stockfish/v/18.0.8).
The 7,295,411-byte WASM embeds its small evaluation network. There is no separate
NNUE service, runtime CDN request, native engine, or server analysis endpoint.

The operator review loads the adjacent JavaScript as a classic Web Worker.
Serve `.wasm` as `application/wasm` (the project's Python static server does so).
This build needs WebAssembly and Workers, but no SharedArrayBuffer, COOP/COEP,
or cross-origin isolation. The upstream [README at the pinned source revision](https://github.com/nmrugg/stockfish.js/blob/93c994592dcf3b4b21052ab925e9b534df9c0918/README.md)
describes the build variants and [worker usage](https://github.com/nmrugg/stockfish.js/blob/93c994592dcf3b4b21052ab925e9b534df9c0918/examples/loadEngine.js).

## Provenance and checksums

- Package version: `18.0.8`
- Source commit (npm `gitHead`): `93c994592dcf3b4b21052ab925e9b534df9c0918`
- JS: [package artifact](https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-lite-single.js)
- WASM: [package artifact](https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-lite-single.wasm)
- JS SHA-256: `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391`
- WASM SHA-256: `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1`

## License and corresponding source

Stockfish.js is copyright 2026 Chess.com, LLC and the Stockfish contributors;
see [AUTHORS](AUTHORS) and the included [GNU GPL v3 license](COPYING.txt).
The unmodified corresponding source, build scripts, and build instructions are
available at the [exact source revision](https://github.com/nmrugg/stockfish.js/tree/93c994592dcf3b4b21052ab925e9b534df9c0918)
and its [source archive](https://github.com/nmrugg/stockfish.js/archive/93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz).
Network attribution is preserved in the JavaScript header. Preserve the license,
attribution, and access to corresponding source when redistributing these files.

## Review model

The adapter targets depth 10 with a two-second search ceiling, serializes all
positions, and normalizes UCI scores to White's perspective. Its only consumer
is the operator HUD. No engine result enters Jev questions, criteria, or state.
Move labels use local capped CP-loss thresholds, not Chess.com's proprietary
classification. Approximate accuracy is `max(0, 100 - 0.5 × ACPL)`.
Missing reviews are omitted from statistics rather than counted as perfect moves.
