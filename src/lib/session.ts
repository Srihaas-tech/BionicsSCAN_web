import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createSessionToken, verifySessionToken } from "./auth-token";
import { readAuthConfiguration } from "./env";

export const SESSION_COOKIE_NAME = "bionics_session";

export async function hasPageSession(): Promise<boolean> {
  try {
    const configuration = readAuthConfiguration();
    const cookieStore = await cookies();
    return verifySessionToken(
      cookieStore.get(SESSION_COOKIE_NAME)?.value,
      configuration.sessionSecret,
    );
  } catch {
    return false;
  }
}

export async function requirePageSession(): Promise<void> {
  if (!(await hasPageSession())) {
    redirect("/login");
  }
}

export function hasApiSession(request: NextRequest): boolean {
  try {
    const configuration = readAuthConfiguration();
    return verifySessionToken(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      configuration.sessionSecret,
    );
  } catch {
    return false;
  }
}

export function createConfiguredSession(): {
  token: string;
  maxAgeSeconds: number;
} {
  const configuration = readAuthConfiguration();
  return {
    token: createSessionToken(configuration.sessionSecret, configuration.sessionTtlHours),
    maxAgeSeconds: configuration.sessionTtlHours * 60 * 60,
  };
}
