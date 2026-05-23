# Stockhold

Stockhold is a small Next.js application that demonstrates concurrency-safe inventory reservations for a multi-warehouse catalog. It was built for the Allo Health engineering take-home exercise.

## What It Does

- Lists products and available inventory across warehouses
- Creates short-lived reservations during checkout
- Confirms reservations when payment succeeds
- Releases reservations when payment fails or expires
- Surfaces `409` stock conflicts and `410` expiry errors directly in the UI

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS
- Zod

## Data Model

The app uses four core models:

- `Product`
- `Warehouse`
- `Inventory`
- `Reservation`

`Inventory` stores:

- `totalUnits`
- `reservedUnits`

`Reservation` stores:

- `status` as `PENDING`, `CONFIRMED`, or `RELEASED`
- `quantity`
- `expiresAt`
- `confirmedAt`
- `releasedAt`

## Concurrency Approach

The reserve flow is the most important part of the exercise.

When a reservation request is created, the server:

1. Starts a database transaction
2. Releases any expired reservations for the same inventory row
3. Runs a guarded SQL `UPDATE` that increments `reservedUnits` only if enough stock is still available
4. Creates the reservation row only if that update succeeds

Because the inventory update and reservation creation happen inside a single transaction, two simultaneous requests for the last unit cannot both succeed. One request wins and the other receives `409`.

## Expiry Approach

This project uses lazy expiry cleanup.

Expired `PENDING` reservations are released automatically during reads and writes:

- product catalog reads
- reservation detail reads
- reserve requests
- confirm requests
- release requests

This keeps inventory accurate without requiring a continuously running worker. In production, this can be complemented with a scheduled job for more proactive cleanup.

## API

### `GET /api/products`

Lists products with per-warehouse availability.

### `GET /api/warehouses`

Lists warehouses.

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
- `409` not enough stock

### `POST /api/reservations/:id/confirm`

Confirms a reservation.

Possible responses:

- `200` reservation confirmed
- `410` reservation expired

### `POST /api/reservations/:id/release`

Releases a reservation early.

Possible responses:

- `200` reservation released

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

```env
DATABASE_URL="your-postgres-connection-string"
RESERVATION_TTL_MINUTES=10
```

3. Generate the Prisma client:

```bash
npm run db:generate
```

4. Apply the schema to your database:

```bash
npx prisma db push
```

5. Seed demo data:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

## Seed Data

The seed script creates:

- 3 warehouses
- 3 products
- a mix of healthy stock and low-stock inventory rows

The low-stock rows are useful for demonstrating reservation conflicts during review.

## Trade-offs

- I chose lazy expiry cleanup because it keeps the project simple and still demonstrates the right inventory behavior.
- I used a straightforward service layer and direct SQL only where correctness under concurrency mattered most.
- I did not add idempotency yet. That would be the next improvement, likely using an `Idempotency-Key` table or Redis.

## Notes

- The UI is intentionally simple and readable so the reservation flow is easy to review.
- The current implementation is designed to work well with hosted PostgreSQL providers such as Neon or Supabase.
