# Port notes: NestJS+Vite → Next.js

What changed going from the [original](https://github.com/jaytalwar/auctiongame)
NestJS backend / Vite+React frontend split to a single Next.js app, and why.

## Kept identical

- **All four `AuctionMechanism` implementations** (English, Dutch, sealed
  first-price, Vickrey) — copied verbatim into `src/lib/domain/auctions/mechanisms/`.
  This is the actual game-theory content of the project; there was no reason
  to touch it.
- **Gale-Shapley matching** — copied verbatim into `src/lib/domain/matching/`.
- **`auctions.service.ts` business logic** — bid validation → wallet escrow →
  anti-snipe → settlement flow is the same sequence of operations, same
  wallet accounting rules (hold / release / capture / credit), same
  anti-sniping constants (30s window, 60s extension).
- **The bid queue design** — one BullMQ queue, worker concurrency 1,
  `waitUntilFinished()` so the HTTP/WebSocket caller still gets a synchronous
  response. This is what actually fixes the double-accept race condition;
  simplifying it away would have removed the most interesting piece of
  system design in the project.
- **Wallet escrow semantics**, including the Vickrey-specific case where the
  winner holds their own bid but only the second-highest price is captured.

## Changed, and why

**One Next.js app instead of NestJS backend + Vite frontend.**
The REST API is now Next.js Route Handlers under `app/api/`; the pages are
in `app/`. Same-origin means the frontend no longer needs an
`VITE_API_URL` env var or the "bare domain silently resolves to the wrong
origin" footgun the original frontend's `api.ts` had a comment about.

**Custom `server.ts` instead of NestJS's app bootstrap.**
Socket.io needs a raw `http.Server` to attach to, and Next's programmatic
API (`next({dev})` + `app.getRequestHandler()`) hands you exactly that. The
BullMQ workers and the auto-close poll are started from the same file, so
it's still one process — same as the original NestJS monolith, just with
Next's request handling instead of Express/Fastify under the hood.

**`node:events` `EventEmitter` instead of `@nestjs/event-emitter`'s `EventEmitter2`.**
Same role — decoupling `auctions.service.ts` from the Socket.io broadcaster
and the notifications listener, so neither needs to know whether a bid came
in over REST or WebSocket. NestJS's DI container doesn't exist here, so the
singleton is a plain module stashed on `globalThis` (see below).

**`globalThis`-stashed singletons instead of NestJS providers.**
No DI container means no natural place for "one instance per process" to
live. `prisma.ts`, `events.ts`, and `queue/queues.ts` all stash their
singleton on `globalThis` rather than module-scope alone — this matters
because Next.js's dev-mode bundler and the plain `tsx`-loaded `server.ts`
can end up with *separate module instances* of the same source file, but
`globalThis` is genuinely one object for the whole Node process regardless
of which loader touched the file, so both sides end up sharing the same
Prisma client / event emitter / BullMQ `Queue` objects. (The BullMQ queues
would work correctly even without this, since they're backed by Redis, not
in-memory state — the singleton is purely to avoid opening a new Redis
connection per request.)

**`bcryptjs` instead of `bcrypt`.** Pure JS, same API, no native build step.

**Custom JWT via `jsonwebtoken` instead of `@nestjs/jwt`.** Same HS256
sign/verify semantics (`JWT_SECRET`, `JWT_EXPIRES_IN`), just called directly
instead of through NestJS's module wrapper. The client still sends
`Authorization: Bearer <token>` and stores the token in `localStorage`,
identical to the original frontend — this wasn't a cookie-based auth
rebuild, just a straight port of the same bearer-token flow onto Next's
Route Handlers.

**`zod` instead of `class-validator` + `class-transformer` DTOs.**
NestJS's `ValidationPipe` + decorated DTO classes don't have a direct
equivalent without NestJS's DI/metadata reflection. `zod` schemas in
`src/lib/validation.ts` cover the same validation (email format, positive
integers for money fields, required vs. optional fields per mechanism).

**Standard `prisma-client-js` generator instead of Prisma 7's new
`prisma-client` generator + `@prisma/client/driver-adapter`.** The original
repo used Prisma 7's newer generator with the `pg` driver adapter. This port
uses the long-stable Prisma 6 + `prisma-client-js` setup instead — same
schema, same models, just the far more battle-tested client generation
path. If you specifically want the new generator/driver-adapter setup, it's
a schema + dependency change, not a rewrite.

## Not ported

**E2E tests** (`app.e2e-spec.ts`, `queue.e2e-spec.ts`, `websocket.e2e-spec.ts`)
were not ported — they required a real Postgres+Redis+running server in
CI. The domain unit tests (mechanisms + matching, ~30 tests) were ported in
full since they're the tests that actually exercise the game theory and
don't need any infrastructure. Re-adding integration tests (e.g. with
Vitest + `supertest`-equivalent fetch calls against a test server) would be
a reasonable follow-up.
