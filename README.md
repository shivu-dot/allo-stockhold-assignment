# Stockhold

Stockhold is a small Next.js application that demonstrates concurrency-safe inventory reservations for a multi-warehouse catalog. It was built for the Allo Health engineering take-home exercise and focuses on the part of the problem that matters most: preventing overselling when multiple users try to reserve the same stock at the same time.

## Live Demo

- Production URL: [https://allo-stockhold-assignment.vercel.app](https://allo-stockhold-assignment.vercel.app)

## What The App Does

- Lists products with inventory split by warehouse
- Creates a temporary reservation during checkout
- Confirms a reservation when payment succeeds
- Releases a reservation when payment fails or when the hold expires
- Shows stock conflict and expiry errors directly in the UI

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma 7
- PostgreSQL
- Tailwind CSS
- Zod

## Core Data Model

The app uses four main tables:

- `Product`
- `Warehouse`
- `Inventory`
- `Reservation`

`Inventory` represents stock for one product in one warehouse and stores:

- `totalUnits`
- `reservedUnits`

Available stock is always calculated as:

```text
availableUnits = totalUnits - reservedUnits
```

`Reservation` stores:

- `status` as `PENDING`, `CONFIRMED`, or `RELEASED`
- `quantity`
- `expiresAt`
- `confirmedAt`
- `releasedAt`

## Reservation Flow

### 1. Reserve

When the user clicks `Reserve`, the server:

1. Starts a database transaction
2. Releases any expired reservations for that inventory row
3. Runs a guarded SQL `UPDATE` on `Inventory`
4. Increments `reservedUnits` only if enough stock is still available
5. Creates a `PENDING` reservation only if the inventory update succeeds

If two users try to reserve the last unit at the same time, both requests can reach the server, but only one transaction can update the row successfully. The other request receives `409 Conflict`.

### 2. Confirm

When the user confirms the purchase:

1. The reservation is checked again inside a transaction
2. The reservation must still be `PENDING`
3. The reservation must not be expired
4. `Reservation.status` changes to `CONFIRMED`
5. `Inventory.reservedUnits` decreases
6. `Inventory.totalUnits` also decreases permanently

This models a completed sale.

### 3. Release

When the user cancels the reservation, or the hold expires:

1. The reservation is marked `RELEASED`
2. `Inventory.reservedUnits` decreases
3. `Inventory.totalUnits` stays the same

This returns the stock back to availability.

## Concurrency Strategy

The most important requirement in this assignment is avoiding race conditions.

This project protects the reserve path with:

- a database transaction
- a guarded SQL `UPDATE` that succeeds only when enough stock is available
- reservation creation inside the same transaction as the inventory change

The critical query updates inventory only when this condition is true:

```text
(totalUnits - reservedUnits) >= requestedQuantity
```

That means the database, not the UI, is the final authority on whether the reservation can be created. This keeps the system safe even if two requests arrive at nearly the same time.

## Expiry Strategy

This project uses lazy expiry cleanup instead of a continuously running worker.

Expired `PENDING` reservations are released automatically during:

- catalog reads
- reservation detail reads
- reserve requests
- confirm requests
- release requests

That keeps the visible inventory accurate without adding background infrastructure to a small take-home project. In a larger production system, I would likely add a scheduled cleanup job as a complement so expiry is also enforced proactively.

## API Summary

### `GET /api/products`

Returns products with per-warehouse inventory.

### `GET /api/warehouses`

Returns the warehouse list.

### `POST /api/reservations`

Creates a reservation.

Request body:

```json
{
  "productId": "string",
  "warehouseId": "string",
  "quantity": 1
}
```

Possible responses:

- `201` reservation created
- `404` inventory row not found
- `409` insufficient stock

### `POST /api/reservations/:id/confirm`

Confirms a reservation.

Possible responses:

- `200` reservation confirmed
- `409` reservation already released or inventory could not be confirmed
- `410` reservation expired

### `POST /api/reservations/:id/release`

Releases a reservation.

Possible responses:

- `200` reservation released
- `409` reservation already confirmed

## Local Setup

### Prerequisites

- Node.js 22+
- A hosted or local PostgreSQL database

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd allo-stockhold-assignment
```

### 2. Create the environment file before installing dependencies

`prisma generate` runs during install and build, so `DATABASE_URL` should be present first.

Create a `.env` file in the project root:

```env
DATABASE_URL="your-postgres-connection-string"
RESERVATION_TTL_MINUTES=10
```

### 3. Install dependencies

```bash
npm install
```

### 4. Push the schema to the database

```bash
npm run db:push
```

### 5. Seed demo data

```bash
npm run db:seed
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed Data

The seed script creates:

- 3 warehouses
- 3 products
- a mix of healthy stock and low-stock inventory rows

The low-stock rows are intentional so the `409` conflict path is easy to demonstrate.

## Deployment Notes

The production app is deployed on Vercel and uses a hosted PostgreSQL database.

Required environment variables:

```env
DATABASE_URL="your-postgres-connection-string"
RESERVATION_TTL_MINUTES=10
```

Because Prisma client generation runs during install and build, `DATABASE_URL` must also be configured in the deployment environment.

## Validation

The project was verified with:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Functional checks covered:

- reserve flow
- cancel flow
- confirm flow
- stock release on expiry
- sold-out conflict handling

## Trade-offs

- I chose lazy expiry cleanup to keep the implementation small and easy to review while still preserving correct inventory behavior.
- I used direct SQL only for the inventory updates where correctness under concurrency mattered most.
- I added transaction retry handling for temporary transaction start delays that can happen with hosted pooled database connections.
- I did not implement idempotency keys yet. That would be the next improvement for making confirm and release flows safer under client retries.

## Notes For Reviewers

- The UI is intentionally simple so the reservation behavior is easy to follow.
- The reservation page includes a visible countdown to make expiry behavior easy to test.
- The main design goal of this submission is correctness and clarity over framework complexity.
