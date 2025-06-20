console.log('🔍 Test basique de Prisma...');

try {
  const { PrismaClient } = require('@prisma/client');
  console.log('✅ Import de PrismaClient réussi');
  
  const prisma = new PrismaClient();
  console.log('✅ Création de l\'instance Prisma réussie');
  
  console.log('⏳ Test de connexion...');
  
  // Test simple avec timeout
  const testConnection = async () => {
    try {
      await prisma.$connect();
      console.log('✅ Connexion réussie!');
      
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Requête réussie:', result);
      
    } catch (error) {
      console.log('❌ Erreur de connexion:', error.message);
      
      if (error.message.includes('Can\'t reach database server')) {
        console.log('🚨 DIAGNOSTIC: Le serveur de base de données est inaccessible');
        console.log('💡 Vérifiez:');
        console.log('   - Votre connexion Internet');
        console.log('   - L\'état du serveur Neon sur console.neon.tech');
        console.log('   - Les credentials dans votre .env');
      }
    } finally {
      await prisma.$disconnect();
      console.log('🔌 Déconnexion effectuée');
    }
  };
  
  testConnection();
  
} catch (importError) {
  console.log('❌ Erreur d\'import:', importError.message);
}
