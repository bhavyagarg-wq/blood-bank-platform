# Architecture

## Overview

```
React dashboards (Vite)
        │  REST /api/v1            WebSocket /socket.io
        ▼                                   ▼
   Express routers  ──►  services  ──►  Prisma  ──►  PostgreSQL
                             │
                             └──►  realtime bus  ──►  Socket.io rooms
```

Routes only validate input (Zod), enforce role and ownership, and delegate. Business rules live in
services. Scoring lives in `src/matching/` as pure functions with no database access, which is what
makes the algorithm cheap to unit test.

## Modules

| Path                          | Responsibility                                                       |
| ----------------------------- | -------------------------------------------------------------------- |
| `src/matching/compatibility.ts` | ABO/Rh compatibility matrix and compatibility score                  |
| `src/matching/scoring.ts`     | Urgency, distance, expiry and rating scores; weights                  |
| `src/matching/matcher.ts`     | Candidate filtering, weighted ranking, travel estimates               |
| `src/services/matchingService.ts` | Persists proposals, accept/reject, status transitions, broadcasts |
| `src/services/inventoryService.ts` | Unit registration, status changes, audit log, utilisation, expiry sweep |
| `src/services/eligibility.ts` | Donor eligibility rules and whole-blood shelf life                    |
| `src/realtime/`               | Socket.io server, room naming, and the emit bus used by services      |
| `src/middleware/`             | JWT auth, RBAC, ownership checks, validation errors, rate limiting    |

`realtime/bus.ts` is a small indirection: services import the bus, not the Socket.io server, so the
same service code runs in tests where no socket server is attached (emits are dropped with a warning).

## Data model

```
Hospital 1─┬─* EmergencyRequest 1─* BloodRequirement
           └─* Match *─1 BloodUnit *─1 BloodBank
Donor 1─* Donation 1─0..1 BloodUnit
BloodUnit 1─* InventoryLog
User *─1 Hospital | BloodBank | Donor
```

- `Match` is unique on `(emergencyRequestId, bloodUnitId)` so re-running matching upserts rather
  than duplicating proposals.
- `InventoryLog` is append-only and records every unit state change with the acting user.
- `BloodBank.currentUtilization` is recomputed inside the same transaction as any unit change.
- Addresses are flattened into columns and distance uses the Haversine formula, so no PostGIS
  extension is required.

## Matching flow

1. Hospital posts an emergency request; requirements are stored and matching runs immediately.
2. `previewMatches` loads available, screened, unexpired units plus active blood banks.
3. `findBestMatches` filters out incompatible units, banks outside the urgency radius and units too
   close to expiry, then ranks the rest by weighted score, keeping each unit only once.
4. The top 10 candidates are upserted as `proposed` matches.
5. `matches_proposed` goes to the hospital room, `potential_match` to each owning blood bank room.
6. On accept: the unit becomes `reserved`, competing proposals for that unit are cancelled, and the
   request status is recomputed from the accepted count versus the total required quantity.
7. On delivery the unit becomes `transfused`; on cancellation it returns to `available`.

## Real-time rooms and events

Sockets authenticate with the same JWT as the REST API and join rooms derived from the token:
`hospital:<id>`, `bloodbank:<id>`, `donor:<id>`, `admin`.

| Event                       | Sent to                     |
| --------------------------- | --------------------------- |
| `inventory_updated`         | owning blood bank, admins   |
| `emergency_request_created` | admins                      |
| `matches_proposed`          | requesting hospital, admins |
| `potential_match`           | each matched blood bank     |
| `match_accepted` / `match_rejected` / `match_status_changed` | hospital + blood bank |
| `request_status_changed`    | requesting hospital         |
| `donation_scheduled`        | blood bank + donor          |

## Testing strategy

- **Unit** (`tests/unit`) — compatibility matrix, each scoring component, ranking and filtering
  rules, donor eligibility. No database.
- **Integration** (`tests/integration`) — Supertest against the real Express app and a dedicated
  `bloodbank_test` database: auth and RBAC, the full request → match → accept → deliver lifecycle,
  inventory and screening, and an end-to-end WebSocket broadcast test.

## Deliberate simplifications

This is a college project, so the following were kept intentionally simple: an in-memory rate
limiter instead of Redis, Haversine distance instead of PostGIS, a straight-line travel estimate
instead of a routing API, and no external email/SMS providers — notifications are WebSocket events.
