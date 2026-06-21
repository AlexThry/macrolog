# MacroLog

Petite app auto-hébergeable de suivi des macros et calories.
Backend Node/Express + SQLite, front responsive (vanilla JS, mobile-first),
auth user/mot de passe par cookie JWT httpOnly.

## Fonctionnalités

- **Aliments** : créer / modifier / supprimer, macros saisies pour 100 g / 100 ml / unité.
- **Recettes** : composées d'aliments, avec nombre de portions ; macros par portion calculées automatiquement.
- **Journal quotidien** : ajouter aliments (par quantité) ou recettes (par portion), navigation par date, totaux et barres de progression vs cibles.
- **Cibles** : kcal / protéines / glucides / lipides modifiables.
- **Multi-utilisateur** : chaque compte a ses propres aliments, recettes et journal.

## Prérequis

- Node.js **18+** (testé sur Node 22). 

## Installation

```bash
cd backend
cp .env.example .env
# Édite .env : mets un JWT_SECRET long et aléatoire
#   openssl rand -hex 32
npm install
```

> **Base de données** : l'app utilise `better-sqlite3` (recommandé).
> S'il ne se compile pas sur ta machine (pas de toolchain C), l'app bascule
> automatiquement sur le module SQLite intégré à Node (`node:sqlite`, Node 22+).
> Pour forcer better-sqlite3, assure-toi d'avoir python3 + un compilateur C
> (`build-essential` sur Debian/Ubuntu).

## Créer un utilisateur

```bash
npm run init-user
# saisis identifiant + mot de passe (le mot de passe est haché en bcrypt)
```

Relance la même commande avec un identifiant existant pour réinitialiser son mot de passe.

## Lancer

```bash
npm start
# -> http://localhost:3000
```

## Docker (un seul conteneur)

Tout (API + front) tourne dans **une seule image** : Express sert le front
statique et l'API sur le même port.

```bash
# JWT_SECRET : génère une valeur longue et aléatoire (openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32) docker compose up -d --build
# -> http://localhost:3000
```

La base SQLite est persistée dans le volume `macrolog-data` (monté sur `/data`).

Créer / réinitialiser un utilisateur (commande interactive dans le conteneur) :

```bash
docker compose exec app npm run init-user
```

## Déploiement sur ton serveur

1. Copie le dossier, `npm install`, crée le `.env` (avec `NODE_ENV=production` si tu sers en HTTPS — active le cookie `secure`).
2. Crée l'utilisateur (`npm run init-user`).
3. Lance avec un gestionnaire de process, ex :
   ```bash
   pm2 start server.js --name macrolog
   ```
4. Mets-le derrière un reverse proxy (Nginx/Caddy) avec TLS. Exemple Caddy :
   ```
   macrolog.tondomaine.fr {
       reverse_proxy localhost:3000
   }
   ```

> En production, sers **toujours en HTTPS** et mets `NODE_ENV=production`
> pour que le cookie de session soit `Secure`.

## Données

- Tout est dans un seul fichier SQLite : `backend/data/macrolog.db`
  (modifiable via `DB_PATH` dans `.env`).
- **Sauvegarde** = copier ce fichier (et les `-wal`/`-shm` s'ils existent).

## Notes

- Les macros loggées sont **figées au moment de l'ajout** (snapshot) : modifier
  un aliment plus tard ne réécrit pas ton historique.
- Les macros d'un aliment sont stockées **pour 100** unités de base ;
  une recette les agrège puis divise par le nombre de portions.

## Structure

```
backend/
  server.js        routes API + service du front
  db.js            schéma + adaptateur SQLite
  auth.js          JWT + middleware
  scripts/init-user.js
frontend/public/
  index.html
  styles.css
  app.js           SPA (aucune dépendance)
Dockerfile         image unique (API + front)
docker-compose.yml service unique "app"
```
# macrolog
