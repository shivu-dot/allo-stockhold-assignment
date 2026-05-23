import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getWarehouses } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warehouses = await getWarehouses();

    return NextResponse.json({ warehouses });
  } catch (error) {
    return handleRouteError(error);
  }
}
