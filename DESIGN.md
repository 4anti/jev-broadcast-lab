---
name: Jev Broadcast Lab
description: Replay-booth HUD for TypeSafe Jev. Program red, preview cyan, amber telemetry.
colors:
  void: "#07080b"
  glass: "#0e1118"
  stage: "#141821"
  rack: "#10141c"
  ink: "#e7edf6"
  mute: "#9aa6b8"
  line: "#2a3344"
  program: "#ff2d2d"
  preview: "#3ee0ff"
  amber: "#ffc24a"
  ok: "#4ad48a"
  pill-ok: "#4ad48a"
typography:
  display:
    fontFamily: "Teko, Arial Narrow, sans-serif"
    fontSize: "42px"
    fontWeight: 500
    lineHeight: "0.95"
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Teko, Arial Narrow, sans-serif"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: "0.9"
    letterSpacing: "0.02em"
  title:
    fontFamily: "Teko, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: "1"
    letterSpacing: "0.06em"
  body:
    fontFamily: "Red Hat Text, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.45"
    letterSpacing: "normal"
  label:
    fontFamily: "Red Hat Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "1.3"
    letterSpacing: "0.14em"
rounded:
  sm: "2px"
  md: "2px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "18px"
components:
  button-primary:
    backgroundColor: "{colors.program}"
    textColor: "#140404"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.program}"
    textColor: "#140404"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  input:
    backgroundColor: "#0a0d13"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  plate:
    backgroundColor: "#0c1018"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  pill:
    backgroundColor: "transparent"
    textColor: "{colors.program}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Jev Broadcast Lab

## Overview

**Creative North Star: "Replay VTR booth"**

The lab is a live broadcast control room, not a chess website and not a SaaS dashboard. Two Jevs are VT decks. The board is program out. The operator watches Jev mass and pace alongside a separately labeled Stockfish review layer. Stockfish evaluation, move quality, and estimated accuracy are operator telemetry and never enter Jev's move choices or payload. Seed `daebc0ae` assigned Replay / VTR; the user pin (esports broadcast HUD) beats identity.

Surfaces sit on near-black glass. Program red means live. Preview cyan is the other deck. Amber is telemetry (tokens, CAT-IDs, clocks). Type is condensed for SAN, a workhorse grotesque for controls, and mono only for FEN, ms, and keys. State is also stroke: solid tally for live, dashed for waiting.

**Key Characteristics:**

- Dense HUD, high contrast, spectator energy
- Catalog IDs (CAT-01 Arena) instead of decorative eyebrows
- Flat tonal layers, 2px corners, no purple gradient, no walnut club
- Honest labels: "Jev mass", not win%

## Colors

Program red is live. Preview cyan is the other bus. Amber is the tally. Neutrals stay cold.

### Primary
- **Program Red** (#ff2d2d): Live tally, primary actions, lower-third bar, key "on air" cues. Rare on rest.

### Secondary
- **Preview Cyan** (#3ee0ff): Focus rings, selected jackfield stroke, the other deck, chase pip on the ply tape.

### Tertiary
- **Tally Amber** (#ffc24a): CAT-IDs, SAN display, telemetry emphasis, ticker tag.

### Neutral
- **Void** (#07080b): Page field
- **Glass** (#0e1118): Rail
- **Rack** (#10141c): Settings column
- **Stage** (#141821): Unused stage fill
- **Ink** (#e7edf6): Body text
- **Mute** (#9aa6b8): Labels, clocks
- **Line** (#2a3344): Hairline borders
- **OK Green** (#4ad48a): Env-key pill, pass gates, mass bar start

### Named Rules
**The Program-Scarce Rule.** Program red is for live and commit. Do not flood fills with it.

**The Honest-Mass Rule.** Probability bars use the ok-to-amber gradient and the words "Jev mass". Never paint them as an eval bar.

## Typography

**Display Font:** Teko (Arial Narrow fallback)
**Body Font:** Red Hat Text (Segoe UI fallback)
**Label/Mono Font:** Red Hat Mono

**Character:** Condensed broadcast titling for SAN and booth titles. Text is a readable grotesque. Mono is reserved for numbers, FEN, LAN, and CAT-IDs.

### Hierarchy
- **Display** (500, 42px, 0.95): Booth titles (`h1`)
- **Headline** (500, 56px, 0.9): Last SAN in the lower third (`.san-xl`)
- **Title** (500, 28px, 0.06em): Player plates WHITE / BLACK
- **Body** (400, 14px, 1.45): Lede and controls
- **Label** (600, 11px, 0.14em uppercase): Rack headings, kicker, pills

### Named Rules
**The Mono-For-Telemetry Rule.** Mono is for clocks, tokens, FEN, LAN, and CAT-IDs. It is not the UI voice.

## Layout

Shell is a four-region broadcast frame: 44px strip, 168px rail, flexible main, 28px ticker. Arena main is a two-column booth: stage (board + lower third) and a 280–360px rack. Home is a single scrolling column inside main. Deck slides are 100vh / 100dvh with no inner scroll. Break at 900px: rail goes horizontal, booth stacks.

Spacing rhythm is 8 / 14 / 18. Strip and ticker are 14px inset.

## Elevation & Depth

Flat. Depth is tonal (void / glass / rack) plus 1px `#2a3344` hairlines. No drop shadows. Live vs wait is stroke: solid program red vs dashed line.

### Named Rules
**The Stroke-State Rule.** Solid border = live. Dashed = waiting. Preview inset = selected ply.

## Shapes

Corners are 2px, almost square. Buttons, inputs, plates, and pills share that radius. Seg controls are inset 3px on a `#0a0d13` well. Geometry is rectangular tally, not pills-for-SaaS.

## Components

### Buttons
- **Shape:** 2px, no shadow, uppercase 12px / 700 on primary
- **Primary:** Program red on `#140404` text, padding 9px 12px
- **Ghost:** Transparent, 1px line border, ink text
- **Hover:** Brightness 1.08. Disabled: 0.4 opacity
- **Focus:** 2px preview outline, 2px offset

### Seg / jackfield
- Unselected: mute text on the well
- Selected: `#1a2230` fill plus inset preview stroke

### Plates
- `#0c1018` fill, 1px line. `.live` program border. `.wait` dashed
- Mass bar 6px, ok-to-amber fill

### Inputs
- `#0a0d13` fill, line border, 8px 10px padding. Focus border preview

### Navigation
- Rail mute text, 2px transparent left bar. Current page: ink + program left bar + `#161b26` fill
- CAT-ID in amber mono 10px

### Lower third
- 4px program bar, Teko SAN, mute LAN line, chase pip in program red (steps, 1.05s)

### Pills
- Hairline box, 2px 8px, uppercase mono 10px. `.live` program. `.ok` green. `.warn` amber

## Do's and Don'ts

### Do:
- **Do** label probabilities as Jev mass, not engine eval or win%.
- **Do** keep CAT-IDs on booths (CAT-01 Arena).
- **Do** use program red for live / commit only.
- **Do** keep the key out of the page when env is set; show `env key`.

### Don't:
- **Don't** use walnut-club wood, serif chess-club type, or purple SaaS gradients.
- **Don't** invent logos, prices, or "Jev is Stockfish".
- **Don't** put free-text "explain the move" UI in this chrome. Jev does not write prose.
- **Don't** round corners past 2px or introduce drop shadows.
