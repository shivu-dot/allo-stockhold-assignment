import { NextResponse } from "next/server";

import { ReservationError } from "@/lib/errors";

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
    const isDatabaseUnavailable =
      error.message.includes("DATABASE_URL") ||
      error.message.toLowerCase().includes("database") ||
      error.message.toLowerCase().includes("connection");

    return NextResponse.json(
      {
        message: isDatabaseUnavailable
          ? "The database is not configured or reachable for this deployment."
          : error.message,
      },
      {
        status: isDatabaseUnavailable ? 503 : 400,
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
