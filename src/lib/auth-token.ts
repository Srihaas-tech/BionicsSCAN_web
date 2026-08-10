import { createHash, createHmac, timingSafeEqual } from "node:crypto";

interface SessionPayload {
  version: 1;
  expiresAt: number;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function equalStrings(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function verifyPassword(candidate: string, expected: string): boolean {
  return equalStrings(candidate, expected);
}

export function createSessionToken(
  secret: string,
  ttlHours: number,
  now: number = Date.now(),
): string {
  const payload: SessionPayload = {
    version: 1,
    expiresAt: now + ttlHours * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!token) {
    return false;
  }

  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra || !equalStrings(signature, sign(body, secret))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.version === 1 && Number.isFinite(payload.expiresAt) && payload.expiresAt > now;
  } catch {
    return false;
  }
}
