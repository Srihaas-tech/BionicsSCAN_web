import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adjustInventoryQuantity, InventoryMutationError } from "@/src/db/queries";
import { errorResponse, isSameOrigin } from "@/src/lib/http";
import { hasApiSession } from "@/src/lib/session";

const requestSchema = z.object({ delta: z.union([z.literal(-1), z.literal(1)]) });
const idSchema = z.string().uuid();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!hasApiSession(request)) {
    return errorResponse("Authentication is required.", 401, "UNAUTHORIZED");
  }
  if (!isSameOrigin(request)) {
    return errorResponse("The request origin is invalid.", 403, "INVALID_ORIGIN");
  }

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return errorResponse("The inventory ID is invalid.", 400, "INVALID_ID");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The request body is invalid.", 400, "INVALID_BODY");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("The quantity change must be 1 or -1.", 400, "INVALID_DELTA");
  }

  try {
    const item = await adjustInventoryQuantity(id, parsed.data.delta);
    revalidatePath("/");
    revalidatePath(`/inventory/${id}`);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof InventoryMutationError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return errorResponse(error.message, status, error.code);
    }
    console.error("Quantity update failed", error);
    return errorResponse("The quantity update failed.", 500, "UPDATE_FAILED");
  }
}
