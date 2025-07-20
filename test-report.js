const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestInstance() {
  try {
    console.log('🧪 Criando instância de teste para relatórios...');

    // Buscar uma campanha existente para identificar a instância usada
    const campaign = await prisma.campaign.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!campaign) {
      console.log('❌ Nenhuma campanha encontrada');
      return;
    }

    console.log(`📝 Campanha encontrada: ${campaign.name}`);

    // Criar instância de exemplo (use um número de telefone real para teste)
    const testInstanceName = 'teste-relatorio';
    const testPhoneNumber = '5511999999999'; // SUBSTITUA PELO SEU NÚMERO

    try {
      const instance = await prisma.instance.create({
        data: {
          instanceName: testInstanceName,
          phoneNumber: testPhoneNumber,
          status: 'CONNECTED'
        }
      });

      console.log(`✅ Instância de teste criada: ${instance.instanceName}`);
      console.log(`📱 Número configurado: ${instance.phoneNumber}`);

      // Atualizar a campanha para usar esta instância
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { instance: testInstanceName }
      });

      console.log(`✅ Campanha "${campaign.name}" atualizada para usar a instância de teste`);
      console.log('');
      console.log('🎯 PRÓXIMOS PASSOS:');
      console.log('1. Execute uma campanha');
      console.log(`2. O relatório será enviado para: ${testPhoneNumber}`);
      console.log('3. Verifique seu WhatsApp para ver o relatório automático');
      console.log('');
      console.log('⚠️ IMPORTANTE: Substitua o número de telefone no script antes de usar!');

    } catch (error) {
      if (error.code === 'P2002') {
        console.log('⚠️ Instância de teste já existe');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Erro ao criar instância de teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestInstance();