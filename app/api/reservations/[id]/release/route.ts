import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { releaseReservation } from "@/lib/reservations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const reservation = await releaseReservation(id);

    return NextResponse.json({ reservation });
  } catch (error) {
    return handleRouteError(error);
  }
}
