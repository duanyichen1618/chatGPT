const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ensureDatabase = (databasePath) => {
  const resolvedPath = path.resolve(databasePath);
  const db = new sqlite3.Database(resolvedPath);

  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS header_values (
        primary_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        page_id TEXT,
        header_name TEXT
      )`
    );
  });

  return db;
};

const upsertHeaderValue = (db, payload) => {
  const updatedAt = new Date().toISOString();
  const { primaryKey, value, pageId, headerName } = payload;
  db.run(
    `INSERT INTO header_values (primary_key, value, updated_at, page_id, header_name)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(primary_key)
     DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        page_id = excluded.page_id,
        header_name = excluded.header_name`,
    [primaryKey, String(value), updatedAt, pageId, headerName]
  );
};

module.exports = {
  ensureDatabase,
  upsertHeaderValue
};
