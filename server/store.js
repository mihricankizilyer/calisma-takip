"use strict";

/**
 * DATABASE_URL varsa bulut PostgreSQL (Neon, Supabase, vb.), yoksa yerel SQLite.
 */

var usePg = false;
var sqliteDb = null;
var sqlitePath = "";
var pool = null;

function getSqliteDb() {
  var fs = require("fs");
  var path = require("path");
  var Database = require("better-sqlite3");
  var DATA_DIR = process.env.CALISMA_DATA_DIR
    ? path.resolve(process.env.CALISMA_DATA_DIR)
    : path.join(__dirname, "data");
  var DB_PATH = path.join(DATA_DIR, "calisma.db");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  var db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  db.exec(
    "CREATE TABLE IF NOT EXISTS app_state (" +
      "id INTEGER PRIMARY KEY CHECK (id = 1)," +
      "payload TEXT NOT NULL," +
      "updated_at TEXT NOT NULL" +
      ")"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS users (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "username TEXT UNIQUE NOT NULL COLLATE NOCASE," +
      "password_hash TEXT NOT NULL," +
      "created_at TEXT NOT NULL" +
      ")"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS user_state (" +
      "user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE," +
      "payload TEXT NOT NULL," +
      "updated_at TEXT NOT NULL" +
      ")"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS sessions (" +
      "token TEXT PRIMARY KEY," +
      "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
      "expires_at TEXT NOT NULL" +
      ")"
  );
  return { db: db, path: DB_PATH };
}

async function initPostgres() {
  var pg = require("pg");
  /** Neon / Supabase genelde SSL ister; yerel PG için PGSSLMODE=disable */
  var ssl =
    process.env.PGSSLMODE === "disable"
      ? false
      : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === "true" };
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: ssl,
    max: 10,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 15000,
  });
  await pool.query(
    "CREATE TABLE IF NOT EXISTS app_state (" +
      "id INTEGER PRIMARY KEY CHECK (id = 1)," +
      "payload TEXT NOT NULL," +
      "updated_at TIMESTAMPTZ NOT NULL" +
      ")"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS users (" +
      "id SERIAL PRIMARY KEY," +
      "username TEXT NOT NULL," +
      "password_hash TEXT NOT NULL," +
      "created_at TIMESTAMPTZ NOT NULL" +
      ")"
  );
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower ON users (LOWER(username))");
  await pool.query(
    "CREATE TABLE IF NOT EXISTS user_state (" +
      "user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE," +
      "payload TEXT NOT NULL," +
      "updated_at TIMESTAMPTZ NOT NULL" +
      ")"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS sessions (" +
      "token TEXT PRIMARY KEY," +
      "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
      "expires_at TIMESTAMPTZ NOT NULL" +
      ")"
  );
}

exports.init = async function () {
  if (process.env.DATABASE_URL) {
    usePg = true;
    await initPostgres();
    return { mode: "postgres" };
  }
  usePg = false;
  var s = getSqliteDb();
  sqliteDb = s.db;
  sqlitePath = s.path;
  return { mode: "sqlite", path: s.path };
};

exports.isPg = function () {
  return usePg;
};

exports.getSqlitePath = function () {
  return sqlitePath || (sqliteDb && sqliteDb.name) || "";
};

exports.countUsers = async function () {
  if (usePg) {
    var r = await pool.query("SELECT COUNT(*)::int AS c FROM users");
    return r.rows[0].c;
  }
  var row = sqliteDb.prepare("SELECT COUNT(*) AS c FROM users").get();
  return row.c;
};

exports.getLegacyStateRow = async function () {
  if (usePg) {
    var r = await pool.query("SELECT payload, updated_at FROM app_state WHERE id = 1");
    return r.rows[0] || null;
  }
  return sqliteDb.prepare("SELECT payload, updated_at FROM app_state WHERE id = 1").get() || null;
};

exports.getLegacyPayloadOnly = async function () {
  if (usePg) {
    var r = await pool.query("SELECT payload FROM app_state WHERE id = 1");
    return r.rows[0] || null;
  }
  return sqliteDb.prepare("SELECT payload FROM app_state WHERE id = 1").get() || null;
};

exports.upsertLegacyState = async function (payload, updatedAtIso) {
  if (usePg) {
    await pool.query(
      "INSERT INTO app_state (id, payload, updated_at) VALUES (1, $1, $2) " +
        "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at",
      [payload, updatedAtIso]
    );
    return;
  }
  sqliteDb
    .prepare(
      "INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
    )
    .run(payload, updatedAtIso);
};

exports.findUserByUsername = async function (username) {
  if (usePg) {
    var r = await pool.query(
      "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username]
    );
    return r.rows[0] || null;
  }
  return (
    sqliteDb.prepare("SELECT id, password_hash FROM users WHERE username = ? COLLATE NOCASE").get(username) || null
  );
};

exports.findUserIdByUsername = async function (username) {
  if (usePg) {
    var r = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1", [username]);
    return r.rows[0] ? r.rows[0].id : null;
  }
  var row = sqliteDb.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
  return row ? row.id : null;
};

exports.insertUser = async function (username, passwordHash, createdAtIso) {
  if (usePg) {
    var r = await pool.query(
      "INSERT INTO users (username, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id",
      [username, passwordHash, createdAtIso]
    );
    return r.rows[0].id;
  }
  var info = sqliteDb
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(username, passwordHash, createdAtIso);
  return info.lastInsertRowid;
};

exports.insertUserState = async function (userId, payload, updatedAtIso) {
  if (usePg) {
    await pool.query("INSERT INTO user_state (user_id, payload, updated_at) VALUES ($1, $2, $3)", [
      userId,
      payload,
      updatedAtIso,
    ]);
    return;
  }
  sqliteDb.prepare("INSERT INTO user_state (user_id, payload, updated_at) VALUES (?, ?, ?)").run(userId, payload, updatedAtIso);
};

exports.getUserStateRow = async function (userId) {
  if (usePg) {
    var r = await pool.query("SELECT payload, updated_at FROM user_state WHERE user_id = $1", [userId]);
    return r.rows[0] || null;
  }
  return sqliteDb.prepare("SELECT payload, updated_at FROM user_state WHERE user_id = ?").get(userId) || null;
};

exports.upsertUserState = async function (userId, payload, updatedAtIso) {
  if (usePg) {
    await pool.query(
      "INSERT INTO user_state (user_id, payload, updated_at) VALUES ($1, $2, $3) " +
        "ON CONFLICT (user_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at",
      [userId, payload, updatedAtIso]
    );
    return;
  }
  sqliteDb
    .prepare(
      "INSERT INTO user_state (user_id, payload, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
    )
    .run(userId, payload, updatedAtIso);
};

exports.insertSession = async function (token, userId, expiresAtIso) {
  if (usePg) {
    await pool.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [
      token,
      userId,
      expiresAtIso,
    ]);
    return;
  }
  sqliteDb.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAtIso);
};

exports.getSessionRow = async function (token) {
  if (usePg) {
    var r = await pool.query("SELECT user_id, expires_at FROM sessions WHERE token = $1", [token]);
    return r.rows[0] || null;
  }
  return sqliteDb.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token) || null;
};

exports.deleteSession = async function (token) {
  if (usePg) {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    return;
  }
  sqliteDb.prepare("DELETE FROM sessions WHERE token = ?").run(token);
};

exports.end = async function () {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
