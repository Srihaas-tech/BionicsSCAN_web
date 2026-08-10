import { NextResponse, type NextRequest } from "next/server";
import { pingDatabase } from "@/src/db/queries";
import { errorResponse } from "@/src/lib/http";
import { hasApiSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!hasApiSession(request)) {
    return errorResponse("Authentication is required.", 401, "UNAUTHORIZED");
  }

  const database = await pingDatabase();
  return NextResponse.json(
    { status: database ? "ok" : "unavailable", database },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
