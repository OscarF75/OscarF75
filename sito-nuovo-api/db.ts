// Minimal D1-style wrapper over a postgres.js client, so the booking and
// statistics code keeps the shape it had on the original platform.
// Writes take one advisory lock: bookings are checked and inserted in a
// single statement, and the lock makes concurrent requests run one at a time.
type Sql = any;
const numbered = (q: string) => { let i = 0; return q.replace(/\?/g, () => '$' + (++i)); };
const isRead = (q: string) => /^\s*select/i.test(q);
const pack = (r: any) => ({ results: [...r], meta: { changes: r.count ?? 0 } });
export function d1(sql: Sql) {
  class Statement {
    q: string; a: unknown[];
    constructor(q: string, a: unknown[] = []) { this.q = q; this.a = a; }
    bind(...a: unknown[]) { return new Statement(this.q, a); }
    exec(tx: Sql = sql) { return tx.unsafe(numbered(this.q), this.a as never[]); }
    async first<T = unknown>() { const r = await this.exec(); return (r[0] ?? null) as T | null; }
    async all() { return pack(await this.exec()); }
    async run() {
      if (isRead(this.q)) return pack(await this.exec());
      return pack(await sql.begin(async (tx: Sql) => { await tx.unsafe('SELECT pg_advisory_xact_lock(4711)'); return this.exec(tx); }));
    }
  }
  return {
    prepare: (q: string) => new Statement(q),
    async batch(list: Statement[]) {
      const locked = list.some(s => !isRead(s.q));
      return sql.begin(async (tx: Sql) => {
        if (locked) await tx.unsafe('SELECT pg_advisory_xact_lock(4711)');
        const out = []; for (const s of list) out.push(pack(await s.exec(tx))); return out;
      });
    },
  };
}
