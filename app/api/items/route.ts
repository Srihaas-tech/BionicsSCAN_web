import { NextResponse, type NextRequest } from "next/server";

import { listBionicInventory } from "@/src/lib/bionic-inventory";
import { errorResponse } from "@/src/lib/http";
import { isInventoryType } from "@/src/lib/inventory";
import { hasApiSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!hasApiSession(request)) {
    return errorResponse(
      "Authentication is required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const requestedType = request.nextUrl.searchParams.get("type");

  if (requestedType !== null && !isInventoryType(requestedType)) {
    return errorResponse(
      "The inventory type is invalid.",
      400,
      "INVALID_TYPE",
    );
  }

  const inventoryType = requestedType !== null ? requestedType : undefined;

  try {
    const items = await listBionicInventory(inventoryType);

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Inventory list failed", error);

    return errorResponse(
      "The inventory backend is unavailable.",
      503,
      "INVENTORY_UNAVAILABLE",
    );
  }
}
