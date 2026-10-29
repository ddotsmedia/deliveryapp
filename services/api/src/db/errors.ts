// drizzle wraps driver errors (DrizzleQueryError.cause), so walk the cause chain for the SQLSTATE.
function sqlState(err: unknown): unknown {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code !== undefined) return e.code;
  return sqlState(e.cause);
}
export const isUniqueViolation = (err: unknown): boolean => sqlState(err) === "23505";
