# Guide de création d'une nouvelle base de données Neon

## 🆕 Créer une nouvelle base de données Neon

### Étapes à suivre :

1. **Connectez-vous à Neon Console**
   - Allez sur https://console.neon.tech
   - Connectez-vous à votre compte

2. **Créez un nouveau projet**
   - Cliquez sur "New Project"
   - Nom : "hope-hospital-db"
   - Région : Choisissez EU (plus proche si vous êtes en Europe)
   - Version PostgreSQL : 15 ou 16 (la plus récente)

3. **Récupérez la chaîne de connexion**
   - Une fois le projet créé, allez dans "Dashboard"
   - Copiez la "Connection String"
   - Elle ressemble à : postgresql://username:password@host:5432/dbname?sslmode=require

4. **Mettez à jour votre .env**
   - Remplacez DATABASE_URL par la nouvelle chaîne

5. **Initialisez votre schéma**
   - npx prisma db push
   - ou npx prisma migrate deploy

### 🔄 Alternative : Utiliser une base de données locale

Si Neon continue à poser problème, vous pouvez utiliser PostgreSQL en local :

1. **Installez PostgreSQL**
   - Téléchargez depuis https://www.postgresql.org/download/windows/
   - Installez avec les paramètres par défaut

2. **Créez une base locale**
   ```bash
   createdb hope_hospital
   ```

3. **URL de connexion locale**
   ```
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/hope_hospital"
   ```

### 🆘 Si vous choisissez la base locale

1. Installez PostgreSQL
2. Mettez à jour votre .env avec l'URL locale
3. Exécutez : npx prisma db push
4. Votre application fonctionnera immédiatement

### 📞 Support Neon

Si vous voulez récupérer vos données existantes :
- Contactez le support Neon via leur console
- Vérifiez l'état de vos projets dans le dashboard
- Les projets gratuits peuvent être suspendus après inactivité

## 🚀 Action recommandée

Pour continuer rapidement :
1. Créez une nouvelle base Neon OU installez PostgreSQL localement
2. Mettez à jour votre .env
3. Exécutez npx prisma db push
4. Testez votre application
