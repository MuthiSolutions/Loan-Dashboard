import { Pool, types } from "pg";

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of pg's default
// JS Date objects, which reinterpret in local time and can shift the day.
types.setTypeParser(1082, (val) => val);

declare global {
  // eslint-disable-next-line no-var
  var __muthiPool: Pool | undefined;
}

/** Reused across hot-reloads in dev so we don't open a new pool on every save. */
export const pool =
  global.__muthiPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.__muthiPool = pool;
}
