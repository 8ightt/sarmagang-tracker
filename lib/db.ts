import postgres from "postgres";
import { cache } from "react";

const g = globalThis as unknown as { __sarmaSql?: postgres.Sql };

function connect(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (use Supabase's transaction pooler connection string).");
  const options = {
    // Supabase's transaction pooler (port 6543) doesn't support prepared statements
    prepare: false,
    idle_timeout: 20,
    // fail fast with a clear error instead of hanging a page render
    connect_timeout: 10,
    // counts and sums come back as bigint: return them as plain numbers
    types: {
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  };
  const client = postgres(url, {
    ...options,
    // Enough connections that a page's queries rarely have to share one...
    max: Number(process.env.DB_POOL_MAX ?? 10),
    // ...and never pipeline: a page with more queries than connections otherwise sends several
    // down one connection back to back, and the pooler mixes them up ("bind message supplies
    // 1 parameters, but prepared statement "" requires 0") or never answers. 0 = one at a time.
    // (a real postgres.js option, missing from its types)
    ...({ max_pipeline: 0 } as object),
  });
  // With max_pipeline 0 postgres.js never reserves a transaction's connection and sql.begin fails
  // (UNSAFE_TRANSACTION), so transactions get their own small pool with the defaults. A transaction
  // stays on one server connection in the pooler, so its queries can't get mixed up.
  let txClient: postgres.Sql | null = null;
  const tx = () => (txClient ??= postgres(url, { ...options, max: 3 }));
  (client as unknown as postgres.Sql).begin = ((...args: Parameters<postgres.Sql["begin"]>) => tx().begin(...args)) as postgres.Sql["begin"];
  return client;
}

export function sql(): postgres.Sql {
  if (!g.__sarmaSql) g.__sarmaSql = connect();
  return g.__sarmaSql;
}

type Snapshot = { data: unknown; updatedAt: number };

/** All EA snapshots in one query, shared by everything rendered for the same request. */
const allSnapshots = cache(async (): Promise<Map<string, Snapshot>> => {
  const rows = await sql()`select key, data, updated_at from snapshots`;
  return new Map(rows.map((r) => [r.key as string, { data: r.data, updatedAt: new Date(r.updated_at).getTime() }]));
});

export async function getSnapshot<T>(key: string): Promise<{ data: T; updatedAt: number } | null> {
  const snap = (await allSnapshots()).get(key);
  return snap ? { data: snap.data as T, updatedAt: snap.updatedAt } : null;
}

export async function setSnapshot(key: string, data: unknown) {
  await sql()`
    insert into snapshots (key, data, updated_at) values (${key}, ${sql().json(data as postgres.JSONValue)}, now())
    on conflict (key) do update set data = excluded.data, updated_at = excluded.updated_at`;
}
