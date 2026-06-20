import 'dotenv/config';
import bcrypt from 'bcryptjs';
import readline from 'readline';
import db from '../db.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, hidden = false) =>
  new Promise((resolve) => {
    if (!hidden) return rl.question(q, resolve);
    // basic hidden input
    const stdin = process.stdin;
    process.stdout.write(q);
    stdin.resume();
    stdin.setRawMode?.(true);
    let val = '';
    const onData = (ch) => {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        stdin.setRawMode?.(false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(val);
      } else if (ch === '\u0003') {
        process.exit();
      } else if (ch === '\u007f') {
        val = val.slice(0, -1);
      } else {
        val += ch;
      }
    };
    stdin.on('data', onData);
  });

(async () => {
  const username = (await ask('Identifiant : ')).trim();
  const password = await ask('Mot de passe : ', true);
  if (!username || !password) {
    console.error('Identifiant et mot de passe requis.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 12);
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
    console.log(`Mot de passe mis à jour pour "${username}".`);
  } else {
    const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    db.prepare('INSERT INTO targets (user_id) VALUES (?)').run(info.lastInsertRowid);
    console.log(`Utilisateur "${username}" créé.`);
  }
  rl.close();
  process.exit(0);
})();
