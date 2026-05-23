import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { createReservation } from "@/lib/reservations";
import { reserveRequestSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = reserveRequestSchema.parse(json);
    const reservation = await createReservation(payload);

    return NextResponse.json(
      {
        reservation,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
