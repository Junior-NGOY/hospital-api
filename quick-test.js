const { PrismaClient } = require('@prisma/client');

// Test simple avec l'URL actuelle du .env
const currentUrl = "postgresql://neondb_owner:DoT8Wxv4KpSt@ep-cool-fire-a5efc9dk-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function quickTest() {
  console.log('🔍 Test rapide avec l\'URL actuelle...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: currentUrl
      }
    }
  });

  try {
    console.log('⏳ Tentative de connexion...');
    await prisma.$connect();
    console.log('✅ Connexion réussie!');
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Requête réussie:', result);
    
  } catch (error) {
    console.log('❌ Erreur:', error.message);
    console.log('💡 Code erreur:', error.code);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('🚨 Le serveur est introuvable - vérifiez l\'URL');
    } else if (error.message.includes('authentication')) {
      console.log('🚨 Problème d\'authentification - vérifiez username/password');
    } else if (error.message.includes('database')) {
      console.log('🚨 Problème de base de données - vérifiez le nom de la DB');
    }
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
