const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const ensureDatabase = async (databasePath) => {
  const resolvedPath = path.resolve(databasePath);
  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(resolvedPath)) {
    const fileBuffer = fs.readFileSync(resolvedPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(
    `CREATE TABLE IF NOT EXISTS header_values (
      primary_key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  const persist = () => {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(resolvedPath, buffer);
  };

  return {
    db,
    persist
  };
};

const upsertHeaderValue = (database, primaryKey, value) => {
  const updatedAt = new Date().toISOString();
  database.db.run(
    `INSERT INTO header_values (primary_key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(primary_key)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [primaryKey, value, updatedAt]
  );
  database.persist();
};

module.exports = {
  ensureDatabase,
  upsertHeaderValue
};
