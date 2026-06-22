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

### Migration vers un nouveau déploiement

Le dossier `data/` est gitignoré : un nouveau déploiement démarre avec une base
vide. Pour transférer les données, exporter en JSON puis réimporter.

```bash
# Ancien serveur
cd backend
npm run export-db                       # -> data/macrolog-export-<date>.json
#   (ou: npm run export-db -- /chemin/sauvegarde.json)

# Copier le fichier .json vers le nouveau serveur, puis :

# Nouveau serveur (après npm install)
cd backend
npm run import-db -- /chemin/macrolog-export-<date>.json
```

> Le dump JSON est portable entre `better-sqlite3` et `node:sqlite`.
> L'import **remplace** le contenu des tables présentes dans le fichier et
> recrée le schéma au besoin (fonctionne sur une base vierge).

## Notes

- Les macros loggées sont **figées au moment de l'ajout** (snapshot) : modifier
  un aliment plus tard ne réécrit pas ton historique.
- Les macros d'un aliment sont stockées **pour 100** unités de base ;
  une recette les agrège puis divise par le nombre de portions.

## Structure

```
backend/
  server.js          setup Express + montage des routers + service du front
  db.js              schéma + migrations + adaptateur SQLite
  auth.js            JWT + middleware
  lib/helpers.js     helpers partagés (macros, recettes, dates)
  routes/            un router par domaine
    auth.js  targets.js  foods.js  recipes.js  log.js  tracker.js
  scripts/
    init-user.js  export-db.js  import-db.js
frontend/public/
  index.html
  styles.css
  js/                SPA en modules ES (aucune dépendance)
    main.js          point d'entrée (boot)
    state.js api.js dom.js dates.js loaders.js ui.js csv.js charts.js
    views/           login.js day.js foods.js recipes.js tracker.js settings.js
Dockerfile           image unique (API + front)
docker-compose.yml   service unique "app"
```
# macrolog
