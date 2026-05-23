import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getCatalog();

    return NextResponse.json({ products });
  } catch (error) {
    return handleRouteError(error);
  }
}
