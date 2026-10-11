import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

// neon-http (the other @neondatabase/serverless driver mode) cannot run transactions at all.
// Every multi-step write needs one (service + audit log in the same transaction), so this app
// uses the WebSocket-based Pool instead. Node 22+ has a global WebSocket, so no extra package.
//
// Lazy singleton: constructing the Pool touches crypto.randomBytes, which Next.js's Cache
// Components treats as an unstable value if it runs while prerendering the static shell. Building
// it only on first use keeps it out of that path entirely.
let instance: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  instance ??= drizzle({
    client: new Pool({ connectionString: process.env.DATABASE_URL! }),
  });
  return instance;
}
