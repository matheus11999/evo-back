const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { configureDatabaseUrl } = require('./databasePath');

async function initializeDatabase() {
  try {
    console.log('🗄️ Inicializando banco de dados...');
    
    // Configurar URL do banco dinamicamente
    const databaseUrl = configureDatabaseUrl();
    console.log(`📊 URL do banco configurada: ${databaseUrl}`);
    
    // Criar diretórios necessários se não existirem
    const prismaDir = path.join(__dirname, '../../prisma');
    const uploadsDir = path.join(__dirname, '../../uploads');
    const logsDir = path.join(__dirname, '../../logs');
    const dataDir = path.join(__dirname, '../../data'); // Diretório local para banco
    
    // Adicionar /data apenas se for um ambiente com volumes configurados
    const dirsToCreate = [prismaDir, uploadsDir, logsDir, dataDir];
    if (fs.existsSync('/data') || process.env.USE_DATA_VOLUME === 'true') {
      dirsToCreate.push('/data');
    }
    
    dirsToCreate.forEach(dir => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log('📁 Diretório criado:', dir);
        } catch (mkdirError) {
          console.error(`❌ Erro ao criar diretório ${dir}:`, mkdirError.message);
        }
      }
      
      // Verificar permissões de escrita
      try {
        const testFile = path.join(dir, '.test-write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ Permissões de escrita OK em: ${dir}`);
      } catch (permError) {
        console.error(`⚠️ Problema de permissões em ${dir}:`, permError.message);
      }
    });
    
    // Inicializar cliente Prisma
    const prisma = new PrismaClient();
    
    // Tentar conectar e aplicar schema
    try {
      console.log('🔗 Conectando ao banco de dados...');
      await prisma.$connect();
      
      // Verificar se as tabelas existem tentando uma consulta simples
      await prisma.user.findFirst();
      console.log('✅ Banco de dados conectado com sucesso');
      
    } catch (error) {
      if (error.code === 'P2021' || error.message.includes('table') || error.message.includes('database file') || error.message.includes('no such table')) {
        console.log('📊 Criando estrutura do banco de dados...');
        
        try {
          // Usar execSync para melhor controle de erro
          const { execSync } = require('child_process');
          
          console.log('🔄 Executando prisma db push...');
          const output = execSync('npx prisma db push --accept-data-loss', {
            cwd: path.join(__dirname, '../..'),
            encoding: 'utf-8',
            stdio: 'pipe'
          });
          
          console.log('📄 Output do Prisma:', output);
          console.log('✅ Estrutura do banco criada com sucesso');
          
          // Reconectar após criar estrutura
          await prisma.$disconnect();
          const newPrisma = new PrismaClient();
          await newPrisma.$connect();
          await newPrisma.user.findFirst();
          console.log('✅ Banco inicializado e pronto para uso');
          
          return newPrisma;
          
        } catch (dbPushError) {
          console.error('❌ Erro ao executar prisma db push:', dbPushError.message);
          console.log('🔄 Tentando continuar sem recriar o banco...');
          
          // Tentar continuar mesmo com erro
          try {
            await prisma.$connect();
            console.log('✅ Conectado ao banco existente');
            return prisma;
          } catch (connectError) {
            console.error('❌ Falha total na conexão com banco:', connectError.message);
            throw connectError;
          }
        }
      } else {
        throw error;
      }
    }
    
    return prisma;
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    throw error;
  }
}

module.exports = { initializeDatabase };