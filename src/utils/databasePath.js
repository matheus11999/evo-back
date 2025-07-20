const fs = require('fs');
const path = require('path');

/**
 * Determina o melhor caminho para o banco de dados baseado no ambiente
 */
function getDatabasePath() {
  // Opções de caminhos em ordem de preferência
  const paths = [
    '/data/production.db',                          // Volume persistente (preferido)
    './data/production.db',                         // Subdiretório data local
    './prisma/production.db',                       // Diretório prisma padrão
    '/tmp/production.db'                            // Fallback temporário
  ];

  for (const dbPath of paths) {
    try {
      const dir = path.dirname(path.resolve(dbPath));
      
      // Verificar se o diretório existe ou pode ser criado
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Testar permissões de escrita
      const testFile = path.join(dir, '.test-write');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      console.log(`✅ Usando caminho do banco: ${dbPath}`);
      return `file:${dbPath}`;
      
    } catch (error) {
      console.log(`⚠️ Caminho ${dbPath} não disponível: ${error.message}`);
      continue;
    }
  }
  
  // Se nenhum caminho funcionar, usar o padrão do Prisma
  console.log('⚠️ Usando banco em memória como fallback');
  return 'file:memory.db';
}

/**
 * Configura a URL do banco dinamicamente
 */
function configureDatabaseUrl() {
  // Se DATABASE_URL já está configurada e válida, usar ela
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'file:/data/production.db') {
    console.log(`📊 Usando DATABASE_URL configurada: ${process.env.DATABASE_URL}`);
    return process.env.DATABASE_URL;
  }
  
  // Detectar automaticamente o melhor caminho
  const databaseUrl = getDatabasePath();
  
  // Atualizar a variável de ambiente
  process.env.DATABASE_URL = databaseUrl;
  
  return databaseUrl;
}

module.exports = {
  getDatabasePath,
  configureDatabaseUrl
};