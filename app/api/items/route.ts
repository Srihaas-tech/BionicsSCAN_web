import { NextResponse, type NextRequest } from "next/server";
import { listInventoryItems } from "@/src/db/queries";
import { errorResponse } from "@/src/lib/http";
import { isInventoryType } from "@/src/lib/inventory";
import { hasApiSession } from "@/src/lib/session";
import { syncSheetToDatabase } from "@/src/lib/inventory-sync";

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

  const inventoryType =
    requestedType !== null ? requestedType : undefined; 

  try {
    try {
      await syncSheetToDatabase(inventoryType);
    } catch (error) {
      console.error("Spreadsheet import failed", error);
    }

    const items = await listInventoryItems(inventoryType);

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
      "The database is unavailable.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  }
}