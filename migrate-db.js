const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('🚀 Iniciando migração do banco de dados...');

    // Verificar se a tabela Instance já existe
    try {
      await prisma.instance.findFirst();
      console.log('✅ Tabela Instance já existe');
    } catch (error) {
      console.log('📝 Criando tabela Instance...');
      
      // Executar SQL para criar a tabela Instance
      await prisma.$executeRaw`
        CREATE TABLE "Instance" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "instanceName" TEXT NOT NULL UNIQUE,
          "phoneNumber" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      console.log('✅ Tabela Instance criada');
    }

    // Migrar instâncias existentes de campanhas (se houver)
    console.log('🔄 Verificando campanhas com instâncias...');
    
    const campaignsWithInstance = await prisma.campaign.findMany({
      where: {
        instance: {
          not: null
        }
      },
      select: {
        instance: true
      },
      distinct: ['instance']
    });

    for (const campaign of campaignsWithInstance) {
      try {
        // Verificar se a instância já existe na nova tabela
        const existingInstance = await prisma.instance.findUnique({
          where: { instanceName: campaign.instance }
        });

        if (!existingInstance) {
          // Criar com número genérico - será atualizado quando o usuário recriar
          await prisma.instance.create({
            data: {
              instanceName: campaign.instance,
              phoneNumber: '0000000000000', // Placeholder
              status: 'UNKNOWN'
            }
          });
          console.log(`📱 Instância migrada: ${campaign.instance}`);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao migrar instância ${campaign.instance}:`, error.message);
      }
    }

    console.log('✅ Migração concluída com sucesso!');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Reinicie o servidor backend');
    console.log('2. Recrie suas instâncias no InstanceManager para vincular os números corretos');
    console.log('3. Configure os relatórios automáticos serão enviados automaticamente');
    console.log('');

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();