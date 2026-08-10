import { NextResponse, type NextRequest } from "next/server";
import { findInventoryItemByBarcode } from "@/src/db/queries";
import { errorResponse } from "@/src/lib/http";
import { hasApiSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ barcode: string }> },
): Promise<NextResponse> {
  if (!hasApiSession(request)) {
    return errorResponse("Authentication is required.", 401, "UNAUTHORIZED");
  }

  const { barcode } = await context.params;
  try {
    const item = await findInventoryItemByBarcode(barcode);
    if (!item) {
      return errorResponse("No inventory item matches that barcode.", 404, "NOT_FOUND");
    }
    return NextResponse.json(
      { item },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Barcode lookup failed", error);
    return errorResponse("The barcode lookup failed.", 500, "LOOKUP_FAILED");
  }
}
