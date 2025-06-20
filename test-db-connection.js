const { PrismaClient } = require('@prisma/client');

// URLs de connexion à tester
const connections = [
  // URL Azure (actuellement commentée dans .env)
  "postgresql://neondb_owner:npg_XbjPk5dl7aOG@ep-wild-butterfly-a8eg2dmf-pooler.eastus2.azure.neon.tech/hope?sslmode=require",
  
  // URL Azure sans pooler
  "postgresql://neondb_owner:npg_XbjPk5dl7aOG@ep-wild-butterfly-a8eg2dmf.eastus2.azure.neon.tech:5432/hope?sslmode=require",
  
  // URL AWS actuelle (dans .env)
  "postgresql://neondb_owner:DoT8Wxv4KpSt@ep-cool-fire-a5efc9dk-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
  
  // URL AWS sans pooler
  "postgresql://neondb_owner:DoT8Wxv4KpSt@ep-cool-fire-a5efc9dk.us-east-2.aws.neon.tech:5432/neondb?sslmode=require",
  
  // URL AWS avec base masomoProDB
  "postgresql://neondb_owner:DoT8Wxv4KpSt@ep-cool-fire-a5efc9dk-pooler.us-east-2.aws.neon.tech/masomoProDB?sslmode=require"
];

async function testConnection(url, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Test ${index + 1}/${connections.length}`);
  console.log(`URL: ${url.replace(/:([^:@]+)@/, ':****@')}`);
  console.log(`${'='.repeat(60)}`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    },
    log: ['error']
  });

  try {
    console.log('⏳ Tentative de connexion...');
    
    // Test de connexion
    await prisma.$connect();
    console.log('✅ Connexion établie avec succès!');
    
    // Test d'une requête simple
    console.log('⏳ Test d\'une requête simple...');
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as current_time`;
    console.log('✅ Requête exécutée avec succès:', result);
    
    // Test de comptage des tables
    try {
      console.log('⏳ Test des tables du schéma...');
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        LIMIT 5
      `;
      console.log('✅ Tables trouvées:', tables);
      
      // Test spécifique à votre schéma
      try {
        const userCount = await prisma.user.count();
        console.log(`✅ Nombre d'utilisateurs dans la base: ${userCount}`);
      } catch (userError) {
        console.log('⚠️ Table "user" non trouvée ou vide:', userError.message);
      }
      
    } catch (schemaError) {
      console.log('⚠️ Erreur lors de la vérification du schéma:', schemaError.message);
    }
    
    console.log('\n🎉 CETTE CONNEXION FONCTIONNE!');
    console.log(`📋 Copiez cette URL dans votre fichier .env:`);
    console.log(`DATABASE_URL="${url}"`);
    
    return { success: true, url };
    
  } catch (error) {
    console.log('❌ Échec de la connexion');
    console.log('🔍 Type d\'erreur:', error.constructor.name);
    console.log('📝 Message d\'erreur:', error.message);
    
    if (error.code) {
      console.log('🏷️ Code d\'erreur:', error.code);
    }
    
    // Diagnostics spécifiques selon le type d'erreur
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('💡 Suggestion: Problème de réseau ou serveur inaccessible');
    } else if (error.message.includes('authentication')) {
      console.log('💡 Suggestion: Vérifiez vos identifiants (username/password)');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('💡 Suggestion: La base de données spécifiée n\'existe pas');
    }
    
    return { success: false, error: error.message };
    
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
  }
}

async function testAllConnections() {
  console.log('🧪 DIAGNOSTIC DE CONNEXION À LA BASE DE DONNÉES');
  console.log('📅 Date:', new Date().toLocaleString());
  console.log('🔍 Nombre de connexions à tester:', connections.length);
  
  const results = [];
  let workingConnection = null;
  
  for (let i = 0; i < connections.length; i++) {
    const result = await testConnection(connections[i], i);
    results.push(result);
    
    if (result.success && !workingConnection) {
      workingConnection = result.url;
      console.log('\n🛑 Connexion fonctionnelle trouvée! Arrêt des tests suivants...');
      break;
    }
    
    // Pause entre les tests
    if (i < connections.length - 1) {
      console.log('\n⏸️ Pause de 2 secondes...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Résumé final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Connexions réussies: ${successCount}`);
  console.log(`❌ Connexions échouées: ${failureCount}`);
  
  if (workingConnection) {
    console.log('\n🎯 CONNEXION RECOMMANDÉE:');
    console.log(`DATABASE_URL="${workingConnection}"`);
    console.log('\n📝 PROCHAINES ÉTAPES:');
    console.log('1. Copiez l\'URL ci-dessus dans votre fichier .env');
    console.log('2. Redémarrez votre serveur de développement');
    console.log('3. Exécutez: npx prisma generate');
    console.log('4. Si nécessaire: npx prisma db push');
  } else {
    console.log('\n🚨 AUCUNE CONNEXION FONCTIONNELLE TROUVÉE');
    console.log('\n🔧 ACTIONS RECOMMANDÉES:');
    console.log('1. Vérifiez l\'état de vos projets sur https://console.neon.tech');
    console.log('2. Obtenez de nouvelles chaînes de connexion');
    console.log('3. Vérifiez que vos bases de données ne sont pas suspendues');
    console.log('4. Créez une nouvelle base de données si nécessaire');
  }
  
  console.log('\n🏁 Test terminé');
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.log('❌ Erreur non gérée:', reason);
});

// Lancement du test
testAllConnections().catch(console.error);
