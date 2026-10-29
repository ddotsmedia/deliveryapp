import type { Db } from "./index.js";
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
