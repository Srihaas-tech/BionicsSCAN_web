import { type NextRequest } from "next/server";
import { generateBarcodePng } from "@/src/lib/barcodes";
import { errorResponse } from "@/src/lib/http";
import { hasApiSession } from "@/src/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  if (!hasApiSession(request)) {
    return errorResponse("Authentication is required.", 401, "UNAUTHORIZED");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return errorResponse("A barcode value is required.", 400, "MISSING_BARCODE");
  }

  try {
    const png = await generateBarcodePng(code);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return errorResponse("The barcode value is invalid.", 400, "INVALID_BARCODE");
  }
}
