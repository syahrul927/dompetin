/**
 * Re-export everything from dompetin-schema.
 * This file is used by db/index.ts for the runtime drizzle instance.
 * The canonical schema is in dompetin-schema.ts (also used by drizzle.config.ts).
 */
export * from "./dompetin-schema";
