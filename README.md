# HOPE API — hospital-api

API Express + Prisma du SaaS hospitalier **HOPE** (RDC). Dépôt : [Junior-NGOY/hospital-api](https://github.com/Junior-NGOY/hospital-api).

Le front Next.js vit dans [Junior-NGOY/hospital](https://github.com/Junior-NGOY/hospital) (`web/`). Ce dossier n’est **pas** versionné dans le dépôt front (gitignoré).

Ce n’est **pas** une API scolaire. Ancien nom de package `starter-ts` / README « masomo » : héritage, à ignorer.

## Stack

- Node, Express 4, TypeScript (`ts-node-dev` en local)
- Prisma 6 → PostgreSQL (**Neon**)
- JWT (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`) — `POST /login`, `GET /me`
- CORS ouvert (`app.use(cors())`)
- Préfixe : `/api/v1`

Entrée : [`src/index.ts`](./src/index.ts). Schéma : [`prisma/schema.prisma`](./prisma/schema.prisma).

## Lancer en local

```bash
cp .env.example .env
# renseigner DATABASE_URL, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, PORT
npm install
npx prisma generate
npx prisma db push          # ou : npx prisma migrate deploy
npm run dev                 # http://localhost:8000
```

Scripts : `dev` (reload), `build` (`prisma generate` + `tsc`), `start` (`node ./dist`), `seed`.

Santé minimale : `GET http://localhost:8000/api/v1/patients` (auth métier encore P0.8). `POST /login` et `GET /me` pour la session.

## Variables d’environnement

Noms uniquement — jamais de secrets dans Git. Copier depuis [`.env.example`](./.env.example).

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `DATABASE_URL` | oui | PostgreSQL Neon (`postgresql://…?sslmode=require`) |
| `ACCESS_TOKEN_SECRET` | oui (prod) | Signature JWT accès (60 min) — `POST /login` |
| `REFRESH_TOKEN_SECRET` | oui (prod) | Signature JWT refresh (30 j) |
| `PORT` | non | Défaut `8000` (Railway fournit souvent `PORT`) |

## Déploiement Railway

1. Projet Railway lié à `Junior-NGOY/hospital-api`.
2. Variables : `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `PORT`.
3. Build : `npm run build` (génère Prisma + `dist/`). Start : `npm start`.
4. URL publique du type `https://HOST.up.railway.app`.
5. Côté Vercel (front) : `NEXT_PUBLIC_API_URL=https://HOST.up.railway.app/api/v1`.

Pas de serverless Vercel pour cette API (processus Node long, Prisma, WebSockets éventuels plus tard). Le script `vercel-build` dans `package.json` est un héritage — **ne pas** s’en servir comme cible prod.

Neon : après changement de schéma, `npx prisma migrate deploy` (ou `db push` en recette). Les projets Neon gratuits se suspendent à l’inactivité.

## Routes montées aujourd’hui

Voir `src/index.ts` : hospitals, consultations, branches, queues, patients, departments, chefcomplaints, medications, medication-categories, users/register/login/me, medical-records (DME), equipment, maintenance, vehicles, medical-supplies.

**Pas monté** : appointments, admissions, invoices, lab-tests, admin (commenté).

Détail métier : [../docs/FONCTIONNALITES.md](../docs/FONCTIONNALITES.md) (si le README est lu depuis le workspace hospital).

## Auth (P0.2)

- `POST /register` et `POST /users` créent un utilisateur (bcrypt) + profil rôle — public (bootstrap).
- `POST /login` vérifie email/mot de passe et renvoie `{ user, accessToken, refreshToken }`.
- `GET /me` et `GET/PUT/DELETE /users` exigent `Authorization: Bearer`.
- Middleware : `src/middleware/auth.ts`. Les routes patients / DME / consultations restent ouvertes jusqu’à P0.8.

## Docs produit (workspace hospital)

Si ce clone est dans `hospital/api/` :

- [../docs/VISION-RDC.md](../docs/VISION-RDC.md)
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [../docs/ROADMAP.md](../docs/ROADMAP.md)
