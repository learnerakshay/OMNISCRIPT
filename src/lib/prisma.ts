import { PrismaClient } from "@prisma/client";

/**
 * Builds a robust PostgreSQL connection URL dynamically from standard SQL_*
 * environment variables, supporting both Unix domain sockets (Cloud SQL proxy) and TCP hosts.
 */
function getDatabaseUrl(): string {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host || !user || !password || !database) {
    // Provide a fallback placeholder to prevent build/lint crashes when env vars are unset
    return "postgresql://placeholder_user:placeholder_pass@localhost:5432/placeholder_db";
  }

  // If SQL_HOST starts with a "/", it represents a Unix domain socket path
  if (host.startsWith("/")) {
    return `postgresql://${user}:${encodeURIComponent(password)}@localhost/${database}?host=${host}`;
  }

  // Fallback to standard TCP connection format
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}/${database}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
