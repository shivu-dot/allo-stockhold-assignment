import { unstable_noStore as noStore } from "next/cache";

import { ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";

export type CatalogProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  warehouses: {
    inventoryId: string;
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
    warehouseLocation: string;
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
  }[];
};

export type ReservationDetails = {
  id: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
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

export async function getCatalog(): Promise<CatalogProduct[]> {
  noStore();
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      inventory: {
        orderBy: {
          warehouse: {
            name: "asc",
          },
        },
        include: {
          warehouse: true,
        },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    description: product.description,
    warehouses: product.inventory.map((item) => ({
      inventoryId: item.id,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouse.name,
      warehouseCode: item.warehouse.code,
      warehouseLocation: item.warehouse.location,
      totalUnits: item.totalUnits,
      reservedUnits: item.reservedUnits,
      availableUnits: Math.max(0, item.totalUnits - item.reservedUnits),
    })),
  }));
}

export async function getWarehouses() {
  noStore();

  return prisma.warehouse.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

export async function getReservationDetails(id: string): Promise<ReservationDetails | null> {
  noStore();

  const existingReservation = await prisma.reservation.findUnique({
    where: { id },
    select: {
      inventoryId: true,
    },
  });

  if (!existingReservation) {
    return null;
  }

  await releaseExpiredReservations(existingReservation.inventoryId);

  const reservation = await prisma.reservation.findUnique({
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
    return null;
  }

  return {
    id: reservation.id,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    createdAt: reservation.createdAt,
    confirmedAt: reservation.confirmedAt,
    releasedAt: reservation.releasedAt,
    product: reservation.product,
    warehouse: reservation.warehouse,
  };
}
