import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

const globalForPostgres = globalThis as typeof globalThis & {
  codetutorSql?: ReturnType<typeof postgres>;
};

export function getDb() {
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  globalForPostgres.codetutorSql ??= postgres(connectionString, { max: 5, prepare: false });
  return globalForPostgres.codetutorSql;
}
