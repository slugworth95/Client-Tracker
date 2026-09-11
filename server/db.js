// Database factory.
//   - Default: SQLite (zero-config, data/client-tracker.db)
//   - Set DATABASE_URL to use Postgres instead (e.g. postgres://user:pass@host:5432/db)
module.exports = process.env.DATABASE_URL
  ? require("./adapters/postgres")
  : require("./adapters/sqlite");