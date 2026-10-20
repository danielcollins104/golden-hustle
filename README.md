# Golden Hustle — Sweepstakes Reference (GC/SC)

Dual-currency sweepstakes implementation: **Gold Coins (GC, fun)** and
**Sweeps Coins (SC, free promotional entries, redeemable)**.

> ⚠ REFERENCE IMPLEMENTATION — not legal advice. Before any public launch:
> counsel-approved official rules, certified RNG (GLI/eCOGRA), KYC vendor
> (Jumio/Veriff), AML program, exclusion-list screening, and a payments
> partner that supports sweepstakes. Check state rules — Washington and
> others restrict sweepstakes casinos.

## Architecture
    server/  Express API — auth, dual wallet, server-authoritative spins,
             AMOE free entry, redemptions, admin endpoints
    public/  the Phaser slot client (GC/SC toggle, auth, AMOE, redeem UI)

The client never decides outcomes: it sends bet+mode, the server spins
(engine.js is a verbatim port of the client math, same seeded strips), and
returns targets + win. The client just animates.

## Run locally
    cd server && npm install && npm start     # http://localhost:3000

## Deploy (free tier) — Railway/Render from GitHub
1. Push this repo to GitHub (phone-friendly: create repo → upload files).
2. Railway → New Project → Deploy from GitHub → pick repo.
   Set root to `server/`, or use the Dockerfile-free Node detect.
3. Env vars: `ADMIN_KEY` (long random string).
4. Add a persistent volume at `server/data.json` (or swap store.js for
   Postgres — the JSON file resets if the instance restarts without one).

## Endpoints
| Route | Purpose |
|---|---|
| POST /api/signup · /api/login | account; welcome grant 5,000 GC + 2.00 SC |
| GET /api/me | balances, free spins, jackpots |
| POST /api/spin | server-authoritative spin (mode: gc\|sc, bet) |
| POST /api/amoe | free SC entry — no purchase necessary (1 per 7 days) |
| POST /api/redeem · GET /api/redeem | SC cash-out requests (min $10) |
| POST /api/bonus/award | GC bonus-game award (capped; production must run bonus RNG server-side) |
| /api/admin/* (x-admin-key) | users, AMOE log, mark redemptions paid |

## What's deliberately simplified (production TODO)
- Bonus door games (vault/arena/moonshot) are replaced by a flat 25×bet
  server award — port their RNG server-side for parity.
- Tokens in memory, JSON file store, no KYC webhook, no rate limiting
  beyond AMOE/bonus cooldowns, no exclusion lists, wheel award is server-side.
