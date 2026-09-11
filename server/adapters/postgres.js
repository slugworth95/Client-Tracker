// Postgres adapter — enabled by setting DATABASE_URL
// (e.g. postgres://user:pass@host:5432/dbname).
// Exposes the same async interface as the SQLite adapter, so the API contract
// is identical regardless of backend.
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Translate SQLite-flavored SQL to Postgres:
//   - datetime('now')  -> to_char(now(), 'YYYY-MM-DD HH24:MI:SS') (same format)
//   - date('now')      -> CURRENT_DATE
//   - ? placeholders   -> $1, $2, ...
function translate(sql) {
  let out = sql
    .replace(/datetime\('now'\)/g, "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/date\('now'\)/g, "CURRENT_DATE");
  let n = 0;
  out = out.replace(/\?/g, () => `$${++n}`);
  return out;
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','past','lost')),
      notes TEXT,
      tags TEXT,
      custom_values TEXT,
      follow_up_date TEXT,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      updated_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS custom_fields (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','number','date')),
      required INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      UNIQUE (user_id, name)
    );
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_client ON notes(client_id);
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS follow_up_date TEXT;
  `);
}

init().catch((err) => {
  console.error("Postgres init failed:", err.message);
  process.exit(1);
});

module.exports = {
  async exec(sql) {
    await pool.query(sql);
  },
  prepare(sql) {
    return {
      async get(...params) {
        const res = await pool.query(translate(sql), params);
        return res.rows[0] || null;
      },
      async all(...params) {
        const res = await pool.query(translate(sql), params);
        return res.rows;
      },
      async run(...params) {
        let finalSql = sql;
        if (/^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)) {
          finalSql = sql.replace(/;\s*$/, "") + " RETURNING id";
        }
        const res = await pool.query(translate(finalSql), params);
        return {
          changes: res.rowCount,
          lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : undefined,
        };
      },
    };
  },
};