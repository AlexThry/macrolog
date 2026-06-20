// SQLite adapter.
// Primary: better-sqlite3 (stable, recommended for production self-hosting).
// Fallback: Node's built-in node:sqlite (Node >= 22) if the native module
// isn't installed. Both expose the small subset of the API this app uses.

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'macrolog.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

// Build a node:sqlite wrapper that mimics the better-sqlite3 surface we use.
function makeBuiltinDatabase(DatabaseSync) {
  return class {
    constructor(path) { this._db = new DatabaseSync(path); }
    pragma(stmt) { try { this._db.exec(`PRAGMA ${stmt};`); } catch { /* ignore */ } }
    exec(sql) { this._db.exec(sql); }
    prepare(sql) {
      const stmt = this._db.prepare(sql);
      return {
        get: (...args) => stmt.get(...args),
        all: (...args) => stmt.all(...args),
        run: (...args) => {
          const r = stmt.run(...args);
          return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
        },
      };
    }
    transaction(fn) {
      return (...args) => {
        this._db.exec('BEGIN');
        try { const out = fn(...args); this._db.exec('COMMIT'); return out; }
        catch (e) { this._db.exec('ROLLBACK'); throw e; }
      };
    }
  };
}

let db;
let mode;

// Try better-sqlite3 first (must actually instantiate to detect missing native binding).
try {
  const mod = await import('better-sqlite3');
  db = new mod.default(DB_PATH);
  mode = 'better-sqlite3';
} catch (err) {
  const { DatabaseSync } = await import('node:sqlite');
  const Builtin = makeBuiltinDatabase(DatabaseSync);
  db = new Builtin(DB_PATH);
  mode = 'node:sqlite (fallback)';
}
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'g',
    kcal REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    servings REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS recipe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    food_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    food_id INTEGER,
    recipe_id INTEGER,
    quantity REAL NOT NULL,
    kcal REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS targets (
    user_id INTEGER PRIMARY KEY,
    kcal REAL NOT NULL DEFAULT 2000,
    protein REAL NOT NULL DEFAULT 175,
    carbs REAL NOT NULL DEFAULT 200,
    fat REAL NOT NULL DEFAULT 60,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_log_user_date ON log_entries(user_id, log_date);
  CREATE INDEX IF NOT EXISTS idx_foods_user ON foods(user_id);
  CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
`);

console.log(`[db] backend = ${mode}, path = ${DB_PATH}`);
export default db;
