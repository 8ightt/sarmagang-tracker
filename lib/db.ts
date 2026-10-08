import postgres from "postgres";

const g = globalThis as unknown as { __sarmaSql?: postgres.Sql };

function connect(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (use Supabase's transaction pooler connection string).");
  return postgres(url, {
    // Supabase's transaction pooler (port 6543) doesn't support prepared statements
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    // counts and sums come back as bigint: return them as plain numbers
    types: {
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
}

export function sql(): postgres.Sql {
  if (!g.__sarmaSql) g.__sarmaSql = connect();
  return g.__sarmaSql;
}

export async function getSnapshot<T>(key: string): Promise<{ data: T; updatedAt: number } | null> {
  const rows = await sql()`select data, updated_at from snapshots where key = ${key}`;
  return rows[0] ? { data: rows[0].data as T, updatedAt: new Date(rows[0].updated_at).getTime() } : null;
}

export async function setSnapshot(key: string, data: unknown) {
  await sql()`
    insert into snapshots (key, data, updated_at) values (${key}, ${sql().json(data as postgres.JSONValue)}, now())
    on conflict (key) do update set data = excluded.data, updated_at = excluded.updated_at`;
}
