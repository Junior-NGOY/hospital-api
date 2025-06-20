# Instructions pour créer une nouvelle base Neon

## 🚀 SOLUTION RAPIDE - Nouvelle base Neon

### 1. Allez sur https://console.neon.tech

### 2. Cliquez "New Project"
- Nom : hope-hospital-v2
- Région : Europe West (amsterdam) - plus proche et rapide
- PostgreSQL 16

### 3. Une fois créé, copiez l'URL de connexion

### 4. Mettez à jour votre .env :
```
DATABASE_URL="postgresql://[username]:[password]@[host]/[database]?sslmode=require"
```

### 5. Initialisez votre schéma :
```bash
npx prisma db push
```

### 6. Testez la connexion :
```bash
npx prisma db pull
```

## 🎯 URL temporaire de test

Si vous voulez tester immédiatement, utilisez cette URL temporaire (remplacez par la vraie) :
```
DATABASE_URL="postgresql://username:password@ep-something-new.region.neon.tech:5432/neondb?sslmode=require"
```

## ⚡ Alternative locale (5 minutes)

1. Téléchargez PostgreSQL : https://www.postgresql.org/download/windows/
2. Installez avec mot de passe : "password"
3. URL : `DATABASE_URL="postgresql://postgres:password@localhost:5432/hope"`
4. Exécutez : `npx prisma db push`

✅ Votre application fonctionnera immédiatement !
