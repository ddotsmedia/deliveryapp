import { createDb, type Db } from "../db/index.js";
import type pg from "pg";

export type DbHandle = { db: Db; pool: pg.Pool };

export function createDbHandle(url: string): DbHandle {
  return createDb(url);
}
