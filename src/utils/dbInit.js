const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    console.log('🗄️ Inicializando banco de dados...');
    
    // Criar diretório prisma se não existir
    const prismaDir = path.join(__dirname, '../../prisma');
    if (!fs.existsSync(prismaDir)) {
      fs.mkdirSync(prismaDir, { recursive: true });
      console.log('📁 Diretório prisma criado');
    }
    
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
      if (error.code === 'P2021' || error.message.includes('table') || error.message.includes('database file')) {
        console.log('📊 Criando estrutura do banco de dados...');
        
        // Executar prisma db push para criar as tabelas
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
          const dbPush = spawn('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
            cwd: path.join(__dirname, '../..'),
            stdio: 'inherit'
          });
          
          dbPush.on('close', async (code) => {
            if (code === 0) {
              console.log('✅ Estrutura do banco criada com sucesso');
              try {
                // Reconectar após criar estrutura
                await prisma.$connect();
                await prisma.user.findFirst();
                console.log('✅ Banco inicializado e pronto para uso');
                resolve(prisma);
              } catch (reconnectError) {
                console.error('❌ Erro ao reconectar:', reconnectError.message);
                reject(reconnectError);
              }
            } else {
              reject(new Error(`Falha ao criar estrutura do banco (código ${code})`));
            }
          });
        });
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