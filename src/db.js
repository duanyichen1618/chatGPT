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
        updated_at TEXT NOT NULL
      )`
    );
  });

  return db;
};

const upsertHeaderValue = (db, primaryKey, value) => {
  const updatedAt = new Date().toISOString();
  db.run(
    `INSERT INTO header_values (primary_key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(primary_key)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [primaryKey, value, updatedAt]
  );
};

module.exports = {
  ensureDatabase,
  upsertHeaderValue
};
