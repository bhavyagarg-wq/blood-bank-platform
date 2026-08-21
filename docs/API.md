# API reference

Base URL: `http://localhost:4000/api/v1`

All endpoints except `/auth/register`, `/auth/login` and `GET /health` require
`Authorization: Bearer <token>`.

Roles: `system_admin`, `hospital_admin`, `blood_bank_admin`, `donor`.

## Auth

| Method | Path             | Roles  | Notes                                             |
| ------ | ---------------- | ------ | ------------------------------------------------- |
| POST   | `/auth/register` | public | Creates a user. 409 if the email already exists.  |
| POST   | `/auth/login`    | public | Returns `{ token, user }`. Rate limited to 10/min. |
| GET    | `/auth/me`       | any    | Current user.                                     |

```http
POST /api/v1/auth/login
{ "email": "hospital@citygeneral.example", "password": "Password123!" }
```

## Hospitals

| Method | Path              | Roles                            |
| ------ | ----------------- | -------------------------------- |
| GET    | `/hospitals`      | any                              |
| GET    | `/hospitals/:id`  | any                              |
| POST   | `/hospitals`      | `system_admin`                   |
| PATCH  | `/hospitals/:id`  | `system_admin`, owning hospital  |

## Blood banks

| Method | Path                                | Roles                              |
| ------ | ----------------------------------- | ---------------------------------- |
| GET    | `/blood-banks`                      | any                                |
| GET    | `/blood-banks/:id`                  | any                                |
| GET    | `/blood-banks/:id/inventory-summary`| any                                |
| POST   | `/blood-banks`                      | `system_admin`                     |
| PATCH  | `/blood-banks/:id`                  | `system_admin`, owning blood bank  |

## Donors

| Method | Path                     | Roles                                     |
| ------ | ------------------------ | ----------------------------------------- |
| GET    | `/donors`                | `system_admin`, `blood_bank_admin`        |
| GET    | `/donors/:id`            | any (donors only see themselves)          |
| GET    | `/donors/:id/eligibility`| any (donors only see themselves)          |
| POST   | `/donors`                | any                                       |
| PATCH  | `/donors/:id`            | any (donors only edit themselves)         |

Eligibility rules: age 18–65, weight ≥ 50 kg, haemoglobin ≥ 12.5 g/dL, and at least 90 days
since the previous donation.

## Blood units

| Method | Path                            | Roles                                     |
| ------ | ------------------------------- | ----------------------------------------- |
| GET    | `/blood-units`                  | any — filters: `bloodBankId`, `bloodType`, `rhFactor`, `status`, `page`, `pageSize` |
| GET    | `/blood-units/summary`          | any — optional `bloodBankId`              |
| POST   | `/blood-units`                  | `system_admin`, owning `blood_bank_admin` |
| POST   | `/blood-units/:id/test-results` | `system_admin`, owning `blood_bank_admin` |
| PATCH  | `/blood-units/:id/status`       | `system_admin`, owning `blood_bank_admin` |
| POST   | `/blood-units/expire-sweep`     | `system_admin`                            |

A reactive screening result (`hiv`, `hepatitisB`, `hepatitisC` or `syphilis` = `true`) marks the
unit `failed` and immediately quarantines it. Every status change writes an `InventoryLog` row.

## Emergency requests

| Method | Path                                  | Roles                                |
| ------ | ------------------------------------- | ------------------------------------ |
| GET    | `/emergency-requests`                 | any (hospital admins see their own)  |
| GET    | `/emergency-requests/:id`             | any                                  |
| POST   | `/emergency-requests`                 | `system_admin`, `hospital_admin`     |
| GET    | `/emergency-requests/:id/match-preview` | any — scores without persisting    |
| POST   | `/emergency-requests/:id/rematch`     | `system_admin`, `hospital_admin`     |
| POST   | `/emergency-requests/:id/cancel`      | `system_admin`, owning hospital      |

Creating a request runs matching immediately and responds with `{ request, matches }`.

```http
POST /api/v1/emergency-requests
{
  "requestedBy": { "doctorName": "Dr. Iyer", "department": "Trauma", "contactNumber": "+91-80-1000-0500" },
  "bloodRequirements": [{ "bloodType": "A", "rhFactor": "positive", "quantity": 2, "priority": "critical" }],
  "urgency": { "level": 1, "requiredBy": "2026-08-21T12:00:00.000Z" },
  "patientInfo": { "age": 35, "gender": "male", "bloodType": "A", "rhFactor": "positive" }
}
```

## Matches

| Method | Path                   | Roles                                      |
| ------ | ---------------------- | ------------------------------------------ |
| GET    | `/matches`             | any (scoped to the caller's org)           |
| POST   | `/matches/:id/accept`  | participants                               |
| POST   | `/matches/:id/reject`  | participants                               |
| PATCH  | `/matches/:id/status`  | participants — `transit`/`delivered`/`cancelled` |

Accepting reserves the unit, cancels competing proposals for the same unit and recomputes the
request status (`matched` → `partial` → `fulfilled`). Allowed transitions:

```
proposed → accepted → transit → delivered
proposed → rejected
accepted|transit → cancelled   (releases the unit back to available)
```

## Donations

| Method | Path                      | Roles                                     |
| ------ | ------------------------- | ----------------------------------------- |
| GET    | `/donations`              | any (scoped to the caller)                |
| POST   | `/donations`              | any (donors only for themselves)          |
| POST   | `/donations/:id/complete` | `system_admin`, owning `blood_bank_admin` |

Completing a donation creates a pending-screening blood unit expiring 42 days after collection and
updates the donor's donation history.

## Analytics

| Method | Path                                  |
| ------ | ------------------------------------- |
| GET    | `/analytics/overview`                 |
| GET    | `/analytics/inventory-by-blood-type`  |
| GET    | `/analytics/expiring-soon`            |
| GET    | `/analytics/match-performance`        |

## Errors

```json
{ "error": "Validation failed", "details": { "fieldErrors": { "email": ["Invalid email"] } } }
```

`400` validation / invalid transition, `401` missing or bad token, `403` wrong role or not the
owner, `404` unknown resource, `409` duplicate, `429` rate limited.
