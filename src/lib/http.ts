import { NextResponse, type NextRequest } from "next/server";

export function errorResponse(message: string, status: number, code: string): NextResponse {
  return NextResponse.json({ error: { message, code } }, { status });
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  return origin === new URL(request.url).origin;
}
