import { NextResponse, type NextRequest } from "next/server";

import { pingBionicInventory } from "@/src/lib/bionic-inventory";
import { errorResponse } from "@/src/lib/http";
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

  const inventory = await pingBionicInventory();
  return NextResponse.json(
    { status: inventory ? "ok" : "unavailable", inventory },
    {
      status: inventory ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
