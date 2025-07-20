const { PrismaClient } = require('@prisma/client');
const evolutionApi = require('./src/services/evolutionApi');

const prisma = new PrismaClient();

async function syncInstances() {
  try {
    console.log('🔄 Sincronizando instâncias com a Evolution API...');

    // Buscar instâncias da Evolution API
    const apiResult = await evolutionApi.listInstances();
    if (!apiResult.success) {
      console.log('❌ Erro ao conectar com Evolution API:', apiResult.error);
      return;
    }

    const apiInstances = apiResult.data || [];
    console.log(`📱 Encontradas ${apiInstances.length} instâncias na Evolution API`);

    for (const apiInstance of apiInstances) {
      try {
        // Verificar se já existe no banco local
        const existingInstance = await prisma.instance.findUnique({
          where: { instanceName: apiInstance.instanceName }
        });

        if (!existingInstance) {
          console.log(`📝 Criando registro para instância: ${apiInstance.instanceName}`);
          await prisma.instance.create({
            data: {
              instanceName: apiInstance.instanceName,
              phoneNumber: '0000000000000', // Placeholder - será atualizado quando o usuário recriar
              status: apiInstance.connectionStatus || 'UNKNOWN'
            }
          });
        } else {
          // Atualizar status
          await prisma.instance.update({
            where: { instanceName: apiInstance.instanceName },
            data: {
              status: apiInstance.connectionStatus || 'UNKNOWN'
            }
          });
        }
      } catch (error) {
        console.log(`⚠️ Erro ao processar instância ${apiInstance.instanceName}:`, error.message);
      }
    }

    console.log('✅ Sincronização concluída!');
    console.log('');
    console.log('📋 PARA ATIVAR RELATÓRIOS AUTOMÁTICOS:');
    console.log('1. Vá para Dashboard > Instâncias WhatsApp');
    console.log('2. Delete suas instâncias existentes');
    console.log('3. Recrie as instâncias com os números corretos');
    console.log('4. Os relatórios serão enviados automaticamente após cada campanha');
    console.log('');

  } catch (error) {
    console.error('❌ Erro durante a sincronização:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncInstances();