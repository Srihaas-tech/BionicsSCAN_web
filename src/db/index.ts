import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readDatabaseUrl } from "../lib/env";
import * as schema from "./schema";

function buildDatabase(client: Pool) {
  return drizzle({ client, schema });
}

type BionicsDatabase = ReturnType<typeof buildDatabase>;

const globalDatabase = globalThis as unknown as {
  bionicsPool?: Pool;
  bionicsDatabase?: BionicsDatabase;
};

export function getPool(): Pool {
  if (!globalDatabase.bionicsPool) {
    globalDatabase.bionicsPool = new Pool({
      connectionString: readDatabaseUrl(),
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
  }
  return globalDatabase.bionicsPool;
}

export function getDatabase(): BionicsDatabase {
  if (!globalDatabase.bionicsDatabase) {
    globalDatabase.bionicsDatabase = buildDatabase(getPool());
  }
  return globalDatabase.bionicsDatabase;
}
