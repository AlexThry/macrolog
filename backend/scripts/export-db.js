// Exporte toute la base SQLite vers un fichier JSON portable.
// Sert à migrer les données vers un nouveau déploiement (voir import-db.js).
// Usage : npm run export-db [-- chemin/de/sortie.json]
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Liste des tables depuis le schéma (on ignore les tables internes SQLite).
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all()
  .map((r) => r.name);

const dump = { exportedAt: new Date().toISOString(), tables: {} };
for (const t of tables) {
  dump.tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath =
  process.argv[2] || join(__dirname, '..', 'data', `macrolog-export-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(dump, null, 2));

const total = Object.values(dump.tables).reduce((n, rows) => n + rows.length, 0);
console.log(`Export OK : ${tables.length} tables, ${total} lignes -> ${outPath}`);
process.exit(0);
