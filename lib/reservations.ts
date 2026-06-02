import { addMinutes } from "date-fns";
import {
  Prisma,
  ReservationStatus,
  type Reservation,
  type PrismaClient,
} from "@prisma/client";

import { getReservationTtlMinutes } from "@/lib/env";
import { ReservationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { ReserveRequest } from "@/lib/validators";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type ReservationWithRelations = Reservation & {
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    location: string;
  };
};

export async function releaseExpiredReservations(inventoryId?: string) {
  await withTransactionRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await releaseExpiredReservationsTx(tx, inventoryId);
    });
  });
}

export async function createReservation(input: ReserveRequest) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId: input.warehouseId,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              location: true,
            },
          },
        },
      });

      if (!inventory) {
        throw new ReservationError(404, "Inventory record not found for this product and warehouse.");
      }

      await releaseExpiredReservationsTx(tx, inventory.id);

      const updatedInventoryRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "Inventory"
        SET
          "reservedUnits" = "reservedUnits" + ${input.quantity},
          "updatedAt" = NOW()
        WHERE
          "id" = ${inventory.id}
          AND ("totalUnits" - "reservedUnits") >= ${input.quantity}
        RETURNING "id"
      `);

      if (updatedInventoryRows.length === 0) {
        const latestInventory = await tx.inventory.findUnique({
          where: {
            id: inventory.id,
          },
        });

        const availableUnits = latestInventory
          ? Math.max(0, latestInventory.totalUnits - latestInventory.reservedUnits)
          : 0;

        throw new ReservationError(
          409,
          `Not enough stock is available right now. Available units: ${availableUnits}.`,
        );
      }

      const reservation = await tx.reservation.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          inventoryId: inventory.id,
          quantity: input.quantity,
          status: ReservationStatus.PENDING,
          expiresAt: addMinutes(new Date(), getReservationTtlMinutes()),
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              location: true,
            },
          },
        },
      });

      return reservation;
    }),
  );
}

export async function confirmReservation(id: string) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const reservation = await getReservationOrThrow(tx, id);

      await releaseExpiredReservationsTx(tx, reservation.inventoryId);

      const now = new Date();
      const confirmation = await tx.reservation.updateMany({
        where: {
          id,
          status: ReservationStatus.PENDING,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          status: ReservationStatus.CONFIRMED,
          confirmedAt: now,
        },
      });

      if (confirmation.count === 0) {
        const latestReservation = await getReservationOrThrow(tx, id);

        if (latestReservation.status === ReservationStatus.CONFIRMED) {
          return latestReservation;
        }

        if (latestReservation.status === ReservationStatus.RELEASED && latestReservation.expiresAt <= now) {
          throw new ReservationError(410, "This reservation expired before it could be confirmed.");
        }

        if (latestReservation.status === ReservationStatus.RELEASED) {
          throw new ReservationError(409, "This reservation has already been released.");
        }

        await releaseExpiredReservationsTx(tx, latestReservation.inventoryId);
        throw new ReservationError(410, "This reservation expired before it could be confirmed.");
      }

      const inventoryRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "Inventory"
        SET
          "totalUnits" = "totalUnits" - ${reservation.quantity},
          "reservedUnits" = "reservedUnits" - ${reservation.quantity},
          "updatedAt" = NOW()
        WHERE
          "id" = ${reservation.inventoryId}
          AND "totalUnits" >= ${reservation.quantity}
          AND "reservedUnits" >= ${reservation.quantity}
        RETURNING "id"
      `);

      if (inventoryRows.length === 0) {
        throw new ReservationError(409, "Inventory could not be confirmed for this reservation.");
      }

      return getReservationOrThrow(tx, id);
    }),
  );
}

export async function releaseReservation(id: string) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const reservation = await getReservationOrThrow(tx, id);

      await releaseExpiredReservationsTx(tx, reservation.inventoryId);

      const latestReservation = await getReservationOrThrow(tx, id);

      if (latestReservation.status === ReservationStatus.CONFIRMED) {
        throw new ReservationError(409, "A confirmed reservation cannot be released.");
      }

      if (latestReservation.status === ReservationStatus.RELEASED) {
        return latestReservation;
      }

      const now = new Date();
      const release = await tx.reservation.updateMany({
        where: {
          id,
          status: ReservationStatus.PENDING,
        },
        data: {
          status: ReservationStatus.RELEASED,
          releasedAt: now,
        },
      });

      if (release.count === 0) {
        return getReservationOrThrow(tx, id);
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE "Inventory"
        SET
          "reservedUnits" = GREATEST(0, "reservedUnits" - ${latestReservation.quantity}),
          "updatedAt" = NOW()
        WHERE "id" = ${latestReservation.inventoryId}
      `);

      return getReservationOrThrow(tx, id);
    }),
  );
}

async function releaseExpiredReservationsTx(tx: TransactionClient, inventoryId?: string) {
  const inventoryFilter = inventoryId
    ? Prisma.sql`AND "inventoryId" = ${inventoryId}`
    : Prisma.empty;

  await tx.$executeRaw(Prisma.sql`
    WITH expired AS (
      UPDATE "Reservation"
      SET
        "status" = 'RELEASED',
        "releasedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE
        "status" = 'PENDING'
        AND "expiresAt" <= NOW()
        ${inventoryFilter}
      RETURNING "inventoryId", "quantity"
    ),
    grouped AS (
      SELECT
        "inventoryId",
        CAST(SUM("quantity") AS INTEGER) AS "releasedQuantity"
      FROM expired
      GROUP BY "inventoryId"
    )
    UPDATE "Inventory" AS inventory
    SET
      "reservedUnits" = GREATEST(0, inventory."reservedUnits" - grouped."releasedQuantity"),
      "updatedAt" = NOW()
    FROM grouped
    WHERE inventory."id" = grouped."inventoryId"
  `);
}

async function getReservationOrThrow(tx: TransactionClient, id: string): Promise<ReservationWithRelations> {
  const reservation = await tx.reservation.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      warehouse: {
        select: {
          id: true,
          name: true,
          code: true,
          location: true,
        },
      },
    },
  });

  if (!reservation) {
    throw new ReservationError(404, "Reservation not found.");
  }

  return reservation;
}

async function withTransactionRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransactionStartTimeout(error) || attempt === attempts) {
        throw error;
      }

      await wait(1000 * attempt);
    }
  }

  throw lastError;
}

function isTransactionStartTimeout(error: unknown) {
  return error instanceof Error && error.message.includes("Unable to start a transaction in the given time");
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
