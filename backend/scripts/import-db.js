// Réimporte un export JSON (voir export-db.js) dans la base SQLite.
// db.js crée le schéma à l'import, donc fonctionne sur une base vierge.
// ATTENTION : remplace le contenu existant des tables présentes dans l'export.
// Usage : npm run import-db -- chemin/de/export.json
import 'dotenv/config';
import { readFileSync } from 'fs';
import db from '../db.js';

const inPath = process.argv[2];
if (!inPath) {
  console.error('Usage : npm run import-db -- <fichier-export.json>');
  process.exit(1);
}

const dump = JSON.parse(readFileSync(inPath, 'utf8'));
const dumpTables = dump.tables || {};

// Ordre sûr pour les clés étrangères : parents avant enfants.
// Toute table inconnue (ajoutée plus tard) est traitée en dernier.
const order = [
  'users', 'foods', 'recipes', 'targets', 'tracker', 'habits',
  'journal_entries', 'weight_entries', 'recipe_items', 'log_entries', 'habit_checks',
];
const names = Object.keys(dumpTables);
const ordered = [
  ...order.filter((t) => names.includes(t)),
  ...names.filter((t) => !order.includes(t)),
];

db.pragma('foreign_keys = OFF');

const importAll = db.transaction(() => {
  // Vide les tables (enfants d'abord) puis réinsère.
  for (const t of [...ordered].reverse()) db.prepare(`DELETE FROM ${t}`).run();

  let total = 0;
  for (const t of ordered) {
    const rows = dumpTables[t] || [];
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const sql = `INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols
      .map(() => '?')
      .join(', ')})`;
    const stmt = db.prepare(sql);
    for (const row of rows) {
      stmt.run(...cols.map((c) => row[c]));
      total++;
    }
  }
  return total;
});

const total = importAll();
db.pragma('foreign_keys = ON');
console.log(`Import OK : ${total} lignes importées depuis ${inPath}`);
process.exit(0);
