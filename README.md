# Auction & Matching Engine (Next.js)

A real-time auction platform implementing **four auction mechanisms** and a
**stable-matching engine**, rebuilt on a modern full-stack Next.js +
PostgreSQL + Prisma stack. This is a rebuild of the original
[NestJS + React](https://github.com/jaytalwar/auctiongame) version, ported
to a single Next.js app while keeping every piece of domain logic —
mechanism rules, escrow, anti-sniping, notifications — byte-for-byte
equivalent to the original.

See [`docs/PORT_NOTES.md`](docs/PORT_NOTES.md) for exactly what changed in
the port and why.

## The four auction mechanisms

| Mechanism | How it works | Who pays what |
|---|---|---|
| **English (ascending)** | Bidders openly outbid each other; each new bid must beat the current highest by a minimum increment. | Winner pays their own final bid. |
| **Dutch (descending)** | Price starts high and ticks down. First bidder to accept wins instantly at the clock price. | Winner pays the clock price at acceptance. |
| **Sealed first-price** | Everyone submits one hidden bid. Highest wins. | Winner pays their own bid — rational bidders shade below true value. |
| **Vickrey (second-price sealed-bid)** | Same as sealed first-price, but... | Winner pays the *second*-highest bid. Bidding your true value is a weakly dominant strategy — see [`tests/domain/auctions/vickrey.mechanism.spec.ts`](tests/domain/auctions/vickrey.mechanism.spec.ts), a 500-trial randomized simulation proving it. |

Plus a **Gale-Shapley stable-matching** implementation
([`src/lib/domain/matching/gale-shapley.ts`](src/lib/domain/matching/gale-shapley.ts)),
independent of the auction system, with a stability checker
([`tests/domain/matching/gale-shapley.spec.ts`](tests/domain/matching/gale-shapley.spec.ts)).

## Tech stack

- **Framework:** Next.js 16 (App Router), TypeScript, React 19
- **Database:** PostgreSQL via Prisma 6
- **Auth:** Custom JWT (jsonwebtoken + bcryptjs), Bearer token stored client-side
- **Real-time:** Socket.io, backed by Redis pub/sub (`@socket.io/redis-adapter`) for horizontal scaling
- **Bid queue:** BullMQ + Redis, worker concurrency 1 — serializes concurrent bids on the same auction so a race can't double-accept
- **Styling:** Tailwind CSS 4
- **Tests:** Vitest, for the framework-agnostic domain logic (mechanisms + matching)

Everything — pages, REST API (as Next.js Route Handlers), the Socket.io
gateway, the BullMQ workers, and the auto-close scheduler — runs in **one
Node process**, started by [`server.ts`](server.ts), which wraps the Next.js
request handler in a plain `http.Server` so Socket.io can attach to it.
This is why deployment needs a host that runs a persistent Node process
(Railway, Render, Fly.io, a VPS, etc.) rather than Vercel's serverless
functions — see [Deployment](#deployment) below.

## Project layout

```
auction-game/
├── server.ts                    Custom server: Next.js + Socket.io + workers + scheduler
├── prisma/schema.prisma          User, Wallet, Auction, Bid, Notification models
├── src/
│   ├── lib/
│   │   ├── domain/                   Framework-agnostic domain logic (no DB, no HTTP)
│   │   │   ├── auctions/mechanisms/      The four AuctionMechanism implementations
│   │   │   └── matching/                 Gale-Shapley stable matching
│   │   ├── auctions.service.ts       Wires domain logic to Postgres + wallet escrow
│   │   ├── wallet.service.ts         Escrow: hold / release / capture funds
│   │   ├── notifications.service.ts  Persisted notifications
│   │   ├── notifications-listener.ts Turns auction events into notifications
│   │   ├── socket-server.ts          Socket.io gateway (same auctionsService as REST)
│   │   ├── queue/                    BullMQ: bid-processing queue + auction-closing queue
│   │   ├── scheduler.ts              Safety-net poll for auto-closing expired auctions
│   │   ├── events.ts                 In-process event bus connecting service ↔ transport
│   │   └── client/                   Browser-side API client, socket client, types, format helpers
│   ├── context/AuthContext.tsx   Session, wallet, and WebSocket connection lifecycle
│   └── components/               Navbar, notifications dropdown, auction card, countdown
├── app/
│   ├── api/                      REST endpoints as Route Handlers (auth, auctions, wallet, notifications)
│   ├── page.tsx                  Home — browse auctions
│   ├── login/, register/, create/
│   └── auctions/[id]/page.tsx    Live auction detail page
└── tests/domain/                 Vitest unit tests for the mechanisms + matching
```

The domain logic under `src/lib/domain/` is deliberately independent of
Next.js, Prisma, or the transport layer — an `AuctionMechanism` just takes a
list of bids and a context, and returns who won and what they pay. That's
what makes it possible to unit test the actual game theory without a
database or a running server.

## API endpoints

All money amounts are integers in **cents**.

| Endpoint | Auth | What it does |
|---|---|---|
| `POST /api/auth/register` | — | Create an account. Starts with a $1000 (100,000¢) wallet balance. |
| `POST /api/auth/login` | — | Get a JWT. |
| `GET /api/wallet/me` | Bearer | Current balance + amount held in escrow. |
| `POST /api/auctions` | Bearer | Create an auction (`mechanism`: `ENGLISH` \| `DUTCH` \| `SEALED_FIRST_PRICE` \| `VICKREY`). |
| `GET /api/auctions` | — | List auctions. |
| `GET /api/auctions/:id` | — | Auction detail + bid history. |
| `POST /api/auctions/:id/bids` | Bearer | Place a bid — validated by the mechanism, funds held in escrow. |
| `POST /api/auctions/:id/close` | Bearer (seller only) | Resolves the mechanism, settles escrow, pays the seller. |
| `GET /api/notifications` | Bearer | This user's notifications. |
| `POST /api/notifications/:id/read` | Bearer | Mark one read. |

## Real-time layer

Socket.io namespace `/auctions`:

| Client → Server | Payload | What happens |
|---|---|---|
| `auction:join` | `{ auctionId }` | Joins that auction's broadcast room (no token needed to watch). |
| `auction:leave` | `{ auctionId }` | Leaves the room. |
| `auction:bid` | `{ auctionId, amount }` | Places a bid through the exact same path as the REST endpoint. Requires a JWT via `{ auth: { token } }` on connection. Ack returns `{ accepted, bid }` or `{ accepted: false, reason }`. |

| Server → Client | Payload | When |
|---|---|---|
| `auction:bid-placed` | `{ auctionId, bid, auction }` | Any accepted bid, from either transport. |
| `auction:extended` | `{ auctionId, closesAt }` | Anti-sniping pushed the deadline back. |
| `auction:closed` | `{ auction }` | Auction resolved, manually or automatically. |
| `notification:new` | `Notification` | Pushed the instant one is created, to that user's personal room. |

**Anti-sniping**: a bid landing within 30 seconds of `closesAt` pushes the
deadline back by 60 seconds. **Bid serialization**: every bid goes through
one BullMQ queue with worker concurrency 1, so two simultaneous bids on the
same auction are processed strictly one at a time — the second one always
correctly sees the first one's result.

## Running it locally

```bash
docker compose up -d          # Postgres + Redis
npm install
cp .env.example .env          # defaults already match docker-compose
npm run db:migrate            # create the database schema
npm run dev                   # http://localhost:3000
```

## Running the tests

```bash
npm test                      # domain logic unit tests — no infra needed
```

## Deployment

Because Socket.io + BullMQ workers run in-process inside `server.ts`, this
needs a host that keeps a Node process running (Railway, Render, Fly.io, a
VPS) rather than Vercel's serverless functions. Build with `npm run build`,
run migrations with `npm run db:deploy`, then start with `npm start`.
