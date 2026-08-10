import { z } from "zod";

const authSchema = z.object({
  APP_PASSWORD: z.string().min(12, "APP_PASSWORD must contain at least 12 characters."),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must contain at least 32 characters."),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
});

export interface AuthConfiguration {
  password: string;
  sessionSecret: string;
  sessionTtlHours: number;
}

export function readAuthConfiguration(): AuthConfiguration {
  const result = authSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join(" "));
  }

  return {
    password: result.data.APP_PASSWORD,
    sessionSecret: result.data.SESSION_SECRET,
    sessionTtlHours: result.data.SESSION_TTL_HOURS,
  };
}

export function getAuthConfigurationError(): string | null {
  try {
    readAuthConfiguration();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Authentication is not configured.";
  }
}

export function readDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return value;
}
