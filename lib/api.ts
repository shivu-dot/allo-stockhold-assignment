import { NextResponse } from "next/server";

import { ReservationError } from "@/lib/reservations";

export function handleRouteError(error: unknown) {
  if (error instanceof ReservationError) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: error.statusCode,
      },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: 400,
      },
    );
  }

  return NextResponse.json(
    {
      message: "An unexpected error occurred.",
    },
    {
      status: 500,
    },
  );
}
