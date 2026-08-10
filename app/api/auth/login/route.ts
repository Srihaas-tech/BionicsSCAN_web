import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword } from "@/src/lib/auth-token";
import { readAuthConfiguration } from "@/src/lib/env";
import { createConfiguredSession, SESSION_COOKIE_NAME } from "@/src/lib/session";

function redirectToLogin(request: NextRequest, error: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let configuration;
  try {
    configuration = readAuthConfiguration();
  } catch {
    return redirectToLogin(request, "configuration");
  }

  const formData = await request.formData();
  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password, configuration.password)) {
    return redirectToLogin(request, "invalid");
  }

  const session = createConfiguredSession();
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "strict",
    path: "/",
    maxAge: session.maxAgeSeconds,
  });
  return response;
}
