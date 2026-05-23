import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const [centralWarehouse, eastWarehouse, southWarehouse] = await Promise.all([
    prisma.warehouse.upsert({
      where: { code: "BLR-CENTRAL" },
      update: {
        name: "Bengaluru Central",
        location: "Bengaluru, Karnataka",
      },
      create: {
        code: "BLR-CENTRAL",
        name: "Bengaluru Central",
        location: "Bengaluru, Karnataka",
      },
    }),
    prisma.warehouse.upsert({
      where: { code: "HYD-EAST" },
      update: {
        name: "Hyderabad East",
        location: "Hyderabad, Telangana",
      },
      create: {
        code: "HYD-EAST",
        name: "Hyderabad East",
        location: "Hyderabad, Telangana",
      },
    }),
    prisma.warehouse.upsert({
      where: { code: "CHN-SOUTH" },
      update: {
        name: "Chennai South",
        location: "Chennai, Tamil Nadu",
      },
      create: {
        code: "CHN-SOUTH",
        name: "Chennai South",
        location: "Chennai, Tamil Nadu",
      },
    }),
  ]);

  const [proteinBars, electrolyteMix, shakerBottle] = await Promise.all([
    prisma.product.upsert({
      where: { sku: "AH-PBAR-12" },
      update: {
        name: "Protein Bar Pack",
        slug: "protein-bar-pack",
        description: "Twelve chocolate peanut bars packed for fast-moving checkout traffic.",
      },
      create: {
        sku: "AH-PBAR-12",
        slug: "protein-bar-pack",
        name: "Protein Bar Pack",
        description: "Twelve chocolate peanut bars packed for fast-moving checkout traffic.",
      },
    }),
    prisma.product.upsert({
      where: { sku: "AH-ELEC-20" },
      update: {
        name: "Electrolyte Mix",
        slug: "electrolyte-mix",
        description: "Twenty sachets with steady demand across all warehouses.",
      },
      create: {
        sku: "AH-ELEC-20",
        slug: "electrolyte-mix",
        name: "Electrolyte Mix",
        description: "Twenty sachets with steady demand across all warehouses.",
      },
    }),
    prisma.product.upsert({
      where: { sku: "AH-SHKR-01" },
      update: {
        name: "Steel Shaker Bottle",
        slug: "steel-shaker-bottle",
        description: "A low-stock item that makes concurrency easy to demonstrate.",
      },
      create: {
        sku: "AH-SHKR-01",
        slug: "steel-shaker-bottle",
        name: "Steel Shaker Bottle",
        description: "A low-stock item that makes concurrency easy to demonstrate.",
      },
    }),
  ]);

  const inventorySeed = [
    { productId: proteinBars.id, warehouseId: centralWarehouse.id, totalUnits: 14 },
    { productId: proteinBars.id, warehouseId: eastWarehouse.id, totalUnits: 9 },
    { productId: electrolyteMix.id, warehouseId: centralWarehouse.id, totalUnits: 22 },
    { productId: electrolyteMix.id, warehouseId: southWarehouse.id, totalUnits: 16 },
    { productId: shakerBottle.id, warehouseId: centralWarehouse.id, totalUnits: 2 },
    { productId: shakerBottle.id, warehouseId: eastWarehouse.id, totalUnits: 1 },
  ];

  for (const item of inventorySeed) {
    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: {
          productId: item.productId,
          warehouseId: item.warehouseId,
        },
      },
      update: {
        totalUnits: item.totalUnits,
        reservedUnits: 0,
      },
      create: {
        productId: item.productId,
        warehouseId: item.warehouseId,
        totalUnits: item.totalUnits,
        reservedUnits: 0,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
