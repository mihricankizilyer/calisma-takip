"use strict";

var crypto = require("crypto");
var fs = require("fs");
var os = require("os");
var path = require("path");
var express = require("express");
var cors = require("cors");
var Database = require("better-sqlite3");

var PORT = process.env.PORT || 3000;
/** Tüm ağ arayüzlerinde dinle (telefon aynı Wi‑Fi’den PC’nin IP’si ile bağlanabilsin). */
var HOST = process.env.HOST || "0.0.0.0";
var API_KEY = process.env.CALISMA_API_KEY || "";
/** HTTP Basic: tüm site + API (HTML dahil) — sadece şifreyi bilen tarayıcılar erişir. */
var PRIVATE_USER = process.env.PRIVATE_ACCESS_USER || "";
var PRIVATE_PASS = process.env.PRIVATE_ACCESS_PASS || "";
var ROOT = path.join(__dirname, "..");
var DATA_DIR = path.join(__dirname, "data");
var DB_PATH = path.join(DATA_DIR, "calisma.db");

var SESSION_MS = 365 * 24 * 60 * 60 * 1000;

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

var app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "32mb" }));

function privateAccess(req, res, next) {
  if (!PRIVATE_PASS) return next();
  if (req.method === "OPTIONS") return next();
  var h = req.headers.authorization || "";
  if (h.indexOf("Basic ") !== 0) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Calisma Takip"');
    return res.status(401).send("Yetkisiz");
  }
  var decoded;
  try {
    decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  } catch (e) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Calisma Takip"');
    return res.status(401).send("Yetkisiz");
  }
  var idx = decoded.indexOf(":");
  var u = idx >= 0 ? decoded.slice(0, idx) : "";
  var p = idx >= 0 ? decoded.slice(idx + 1) : decoded;
  var expectedUser = PRIVATE_USER || "ben";
  if (u !== expectedUser || p !== PRIVATE_PASS) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Calisma Takip"');
    return res.status(401).send("Yetkisiz");
  }
  next();
}

app.use(privateAccess);

function legacyMode() {
  var row = db.prepare("SELECT COUNT(*) AS c FROM users").get();
  return !row || row.c === 0;
}

function hashPassword(plain) {
  var salt = crypto.randomBytes(16).toString("hex");
  var hash = crypto.pbkdf2Sync(plain, salt, 100000, 64, "sha512").toString("hex");
  return "pbkdf2$100000$" + salt + "$" + hash;
}

function verifyPassword(plain, stored) {
  var parts = String(stored).split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  var iter = parseInt(parts[1], 10);
  var salt = parts[2];
  var expected = parts[3];
  var check = crypto.pbkdf2Sync(plain, salt, iter, 64, "sha512").toString("hex");
  return check === expected;
}

function getSessionUserId(req) {
  var token = (req.headers["x-calisma-session"] || "").trim();
  if (!token) return null;
  var row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return row.user_id;
}

function createSession(userId) {
  var token = crypto.randomBytes(32).toString("hex");
  var exp = new Date(Date.now() + SESSION_MS).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, exp);
  return token;
}

function apiKeyOk(req) {
  if (PRIVATE_PASS) return true;
  if (!API_KEY) return true;
  return req.headers["x-api-key"] === API_KEY;
}

function defaultPayload() {
  return {
    sessions: [],
    books: [],
    goals: {
      weeklyMinutesEnglish: 0,
      weeklyMinutesTechnical: 0,
      streakMinMinutesPerDay: 15,
    },
    yds: {},
  };
}

function readLegacyState(res) {
  try {
    var row = db.prepare("SELECT payload, updated_at FROM app_state WHERE id = 1").get();
    if (!row) {
      var empty = defaultPayload();
      empty._serverEmpty = true;
      return res.json(empty);
    }
    var data = JSON.parse(row.payload);
    if (!data || typeof data !== "object") data = defaultPayload();
    data._serverUpdatedAt = row.updated_at;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
}

function readUserState(userId, res) {
  try {
    var row = db.prepare("SELECT payload, updated_at FROM user_state WHERE user_id = ?").get(userId);
    if (!row) {
      var empty = defaultPayload();
      empty._serverEmpty = true;
      return res.json(empty);
    }
    var data = JSON.parse(row.payload);
    if (!data || typeof data !== "object") data = defaultPayload();
    data._serverUpdatedAt = row.updated_at;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
}

app.post("/api/auth/register", function (req, res) {
  try {
    var username = req.body && req.body.username != null ? String(req.body.username).trim() : "";
    var password = req.body && req.body.password != null ? String(req.body.password) : "";
    if (!username || !password) {
      return res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli." });
    }
    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ error: "Kullanıcı adı 3–32 karakter olmalı." });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Kullanıcı adında yalnızca harf, rakam ve alt çizgi kullanın." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Şifre en az 8 karakter olmalı." });
    }
    var taken = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (taken) {
      return res.status(409).json({ error: "Bu kullanıcı adı zaten kayıtlı." });
    }
    var migrateLegacy = legacyMode();
    var legacyPayload = null;
    if (migrateLegacy) {
      var legacyRow = db.prepare("SELECT payload FROM app_state WHERE id = 1").get();
      if (legacyRow && legacyRow.payload) legacyPayload = legacyRow.payload;
    }
    var now = new Date().toISOString();
    var ph = hashPassword(password);
    var ins = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)").run(username, ph, now);
    var userId = ins.lastInsertRowid;
    var payload = JSON.stringify(defaultPayload());
    if (legacyPayload) {
      try {
        var parsed = JSON.parse(legacyPayload);
        if (parsed && typeof parsed === "object") payload = JSON.stringify(parsed);
      } catch (e) {}
    }
    db.prepare("INSERT INTO user_state (user_id, payload, updated_at) VALUES (?, ?, ?)").run(userId, payload, now);
    var token = createSession(userId);
    res.json({ ok: true, token: token, username: username });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
});

app.post("/api/auth/login", function (req, res) {
  try {
    var username = req.body && req.body.username != null ? String(req.body.username).trim() : "";
    var password = req.body && req.body.password != null ? String(req.body.password) : "";
    if (!username || !password) {
      return res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli." });
    }
    var user = db.prepare("SELECT id, password_hash FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Kullanıcı adı veya şifre yanlış." });
    }
    var token = createSession(user.id);
    res.json({ ok: true, token: token, username: username });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
});

app.post("/api/auth/logout", function (req, res) {
  try {
    var token = (req.headers["x-calisma-session"] || "").trim();
    if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
});

app.get("/api/state", function (req, res) {
  if (legacyMode()) {
    return readLegacyState(res);
  }
  var uid = getSessionUserId(req);
  if (!uid) {
    return res.status(401).json({ error: "login_required", needLogin: true });
  }
  readUserState(uid, res);
});

app.put("/api/state", function (req, res) {
  if (legacyMode()) {
    if (!apiKeyOk(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      var body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid body" });
      }
      var copy = JSON.parse(JSON.stringify(body));
      delete copy._serverEmpty;
      delete copy._serverUpdatedAt;
      var payload = JSON.stringify(copy);
      var now = new Date().toISOString();
      db.prepare(
        "INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?) " +
          "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
      ).run(payload, now);
      res.json({ ok: true, updated_at: now });
    } catch (e) {
      res.status(500).json({ error: String(e && e.message) });
    }
    return;
  }
  var uid = getSessionUserId(req);
  if (!uid) {
    return res.status(401).json({ error: "login_required", needLogin: true });
  }
  try {
    var body2 = req.body;
    if (!body2 || typeof body2 !== "object") {
      return res.status(400).json({ error: "Invalid body" });
    }
    var copy2 = JSON.parse(JSON.stringify(body2));
    delete copy2._serverEmpty;
    delete copy2._serverUpdatedAt;
    var payload2 = JSON.stringify(copy2);
    var now2 = new Date().toISOString();
    db.prepare(
      "INSERT INTO user_state (user_id, payload, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
    ).run(uid, payload2, now2);
    res.json({ ok: true, updated_at: now2 });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message) });
  }
});

app.use(express.static(ROOT));

function lanIPv4Addresses() {
  var nets = os.networkInterfaces();
  var out = [];
  var name;
  for (name in nets) {
    if (!Object.prototype.hasOwnProperty.call(nets, name)) continue;
    nets[name].forEach(function (n) {
      if (n.family === "IPv4" && !n.internal) out.push(n.address);
    });
  }
  return out;
}

app.listen(PORT, HOST, function () {
  console.log("");
  console.log("Çalışma Takip — bu bilgisayarda: http://localhost:" + PORT);
  var ips = lanIPv4Addresses();
  if (ips.length) {
    console.log("Telefon / tablet (aynı Wi‑Fi, tarayıcıda açın):");
    ips.forEach(function (ip) {
      console.log("  http://" + ip + ":" + PORT);
    });
  } else {
    console.log("Yerel IP bulunamadı; Wi‑Fi’ye bağlı olduğunuzdan emin olun.");
  }
  console.log("");
  console.log("Veritabanı:", DB_PATH);
  console.log("İpucu: Windows Güvenlik Duvarı izin isteyebilir; izin verin.");
  console.log("İnternet (farklı Wi‑Fi): proje kökünde veya server klasöründe  npm run tunnel");
  console.log(
    "Hesap: Sunucuda en az bir kullanıcı kayıtlıysa /api/state oturum (Ayarlar → Giriş) ister."
  );
  if (API_KEY) console.log("API anahtarı: CALISMA_API_KEY aktif (hesap yokken PUT için X-API-Key gerekir).");
  if (PRIVATE_PASS) {
    console.log("Özel erişim: PRIVATE_ACCESS_PASS aktif (sadece kullanıcı adı + şifre ile girilir).");
    console.log("  Kullanıcı adı: " + (PRIVATE_USER || "ben") + " (PRIVATE_ACCESS_USER ile değiştirilebilir)");
  }
});
