# SKILL.md — Golden Hustle Slot Stack (reusable playbook)

How to rebuild, re-skin, and extend this sweepstakes slot from scratch. Verified working: ~90% RTP, server-authoritative, Phaser 3.80.

## Architecture (do not deviate — every deviation was a bug)
- `server/` Node/Express, dual wallet GC/SC, JSON file store. Spins are server-authoritative; the SERVER owns outcomes.
- `public/` Phaser client. `js/net.js` fetches the spin, then calls `GH.api.spin(targets, outcome)` — the SAME spin path as offline/demo mode. Never animate server spins separately (a separate tween path NaN'd for weeks).
- Client `js/engine.js` = pure math (strips, plan, evaluate). Server `server/engine.js` = verbatim port. STRIPLEN must match (sum of symbol weights = 23).
- RTP tuning lives ONLY in symbol `pay` values: current line RTP ~81% + bonus 2*bet (~2.2%) + free spins (~7%) ≈ 90%. Verify with 40k-spin sim before shipping any pay change.

## Asset pipeline (symbol art)
1. Generate ONE square image per symbol, subject on pure black, no text, no frame.
   Master prompt: "Slot machine symbol, [SUBJECT], blacklight neon style, glowing electric magenta and cyan on pure black background, UV-reactive glow, graffiti street-art energy, centered, square, no text, no border frame"
2. Key the subject: alpha = soft luminance threshold (v-12)*4.
3. Tile: hue-owned vertical gradient field (per-symbol hue) + colored identity ring + subject + thin white rim from FIND_EDGES (>70 threshold).
4. Resize 192px, quantize 192 colors (FASTOCTREE). Do NOT outline from glow boundaries — use luminance edges only.
5. Drop into public/assets/symbols/, add `tex` in config.js (keep key/weight/pay intact).

## Hard-won bug list (check these first)
- Phaser tween on reel containers NaNs mid-flight (3.80, container+geometry mask). Mitigation: demo-path spin routing + per-frame isNaN sanitizer in MainScene.update + completion watchdog. Do not remove.
- Browser URL-bar collapse fires resize -> refit loop. Ignore height deltas <60px.
- CSS `zoom` on #dhx for fit-to-screen; fit width in portrait, height in landscape.
- WebAudio: never reference bare `state` in modules; samples via fetch->decodeAudioData with synth fallback (Kenney casino-audio CC0 in assets/sfx/).
- Phaser scene array auto-starts ALL scenes; only BootScene in config array, scene.add('Main',...) explicitly.

## Ops
- Demo instance: `node server.js` + `cloudflared tunnel --url localhost:PORT` (ephemeral; sandbox resets kill bg processes — boot per session).
- Deploy: Railway/Render from this repo; env ADMIN_KEY; volume for server/data.json.
- Admin: GET/POST /api/admin/* with x-admin-key header.
