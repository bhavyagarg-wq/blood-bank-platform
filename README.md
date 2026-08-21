# Blood Bank Platform

Real-time blood bank inventory and matching platform. Hospitals raise emergency blood requests, the
platform scores every available unit across the network and proposes ranked matches, and both sides
see status changes live over WebSockets.

- **Backend** — Node.js, Express, TypeScript, Prisma, PostgreSQL, Socket.io, JWT
- **Frontend** — React + Vite (hospital, blood bank, donor and admin views)
- **Tests** — Jest + Supertest (unit + integration, real database)

## Quick start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # Windows: copy .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend, so open http://localhost:5173.

### Demo accounts

All seeded accounts use the password `Password123!`.

| Role       | Email                          |
| ---------- | ------------------------------ |
| Admin      | `admin@bloodbank.example`      |
| Hospital   | `hospital@citygeneral.example` |
| Blood bank | `bank@central.example`         |
| Donor      | `asha.rao@example.com`         |

## Tests

```bash
cd backend
npm run lint
npm run typecheck
npm test          # unit + integration (uses the bloodbank_test database)
```

Integration tests apply migrations to a separate `bloodbank_test` database, so your seeded
development data is untouched. Override the connection with `TEST_DATABASE_URL` if needed.

## How matching works

Each candidate unit is scored 0–100 on five factors and combined with fixed weights:

| Factor          | Weight | Behaviour                                                                  |
| --------------- | ------ | -------------------------------------------------------------------------- |
| Compatibility   | 0.35   | 100 for the exact ABO/Rh group, 80 for a safe substitute, 0 = excluded      |
| Urgency         | 0.25   | Driven by urgency level 1–5 and how soon the units are needed               |
| Distance        | 0.20   | Haversine distance, linear decay to a radius that widens as urgency drops   |
| Expiry          | 0.15   | Critical cases prefer long shelf life; routine cases prefer near-expiry stock |
| Blood bank rating | 0.05 | Normalised 1–5 star rating                                                 |

Units that are reserved, unscreened, expired, incompatible, or beyond the urgency radius never
become candidates. The top matches are persisted as proposals and pushed to the hospital and the
owning blood banks over WebSockets.

Documentation:

- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, data model and real-time events

## Layout

```
backend/
  prisma/schema.prisma     data model and migrations
  src/matching/            pure scoring + matching logic (no I/O)
  src/services/            inventory, matching and eligibility services
  src/routes/              REST API (/api/v1)
  src/realtime/            Socket.io server, rooms and event bus
  tests/                   unit + integration suites
frontend/
  src/pages/               one dashboard per role
  src/useRealtime.ts       authenticated socket hook
```
