const cron = require('node-cron');
const prisma = require('../utils/prisma');
const evolutionApi = require('./evolutionApi');
const reportService = require('./reportService');

const activeCampaigns = new Map();

async function scheduleCampaign(campaign) {
  try {
    // Parar campanha existente se houver
    if (activeCampaigns.has(campaign.id)) {
      const existingTask = activeCampaigns.get(campaign.id);
      if (existingTask && typeof existingTask.stop === 'function') {
        existingTask.stop();
      }
      activeCampaigns.delete(campaign.id);
    }

    // Verificar se a campanha está ativa
    const currentCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id }
    });

    if (!currentCampaign || currentCampaign.status !== 'ACTIVE') {
      console.log(`⏸️ Campanha "${campaign.name}" não está ativa, não agendando`);
      return;
    }

    if (campaign.interval) {
      const task = cron.schedule(`*/${campaign.interval} * * * * *`, async () => {
        // Verificar novamente se a campanha ainda está ativa antes de executar
        const campaignCheck = await prisma.campaign.findUnique({
          where: { id: campaign.id }
        });
        
        if (campaignCheck && campaignCheck.status === 'ACTIVE') {
          await executeCampaign(campaignCheck);
        } else {
          console.log(`⏸️ Campanha "${campaign.name}" foi pausada, parando execução`);
          if (activeCampaigns.has(campaign.id)) {
            const task = activeCampaigns.get(campaign.id);
            if (task && typeof task.stop === 'function') {
              task.stop();
            }
            activeCampaigns.delete(campaign.id);
          }
        }
      }, { scheduled: false });

      task.start();
      activeCampaigns.set(campaign.id, task);
      console.log(`📅 Campanha "${campaign.name}" agendada com intervalo de ${campaign.interval}s`);
    } else if (campaign.scheduledTime) {
      const task = cron.schedule(campaign.scheduledTime, async () => {
        // Verificar novamente se a campanha ainda está ativa antes de executar
        const campaignCheck = await prisma.campaign.findUnique({
          where: { id: campaign.id }
        });
        
        if (campaignCheck && campaignCheck.status === 'ACTIVE') {
          await executeCampaign(campaignCheck);
        } else {
          console.log(`⏸️ Campanha "${campaign.name}" foi pausada, parando execução`);
          if (activeCampaigns.has(campaign.id)) {
            const task = activeCampaigns.get(campaign.id);
            if (task && typeof task.stop === 'function') {
              task.stop();
            }
            activeCampaigns.delete(campaign.id);
          }
        }
      }, { scheduled: false });

      task.start();
      activeCampaigns.set(campaign.id, task);
      console.log(`📅 Campanha "${campaign.name}" agendada para ${campaign.scheduledTime}`);
    }
  } catch (error) {
    console.error('Erro ao agendar campanha:', error);
  }
}

async function stopCampaign(campaignId) {
  try {
    if (activeCampaigns.has(campaignId)) {
      const task = activeCampaigns.get(campaignId);
      if (task && typeof task.stop === 'function') {
        task.stop();
      }
      activeCampaigns.delete(campaignId);
      
      // Buscar nome da campanha para log
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId }
      });
      
      console.log(`⏹️ Campanha "${campaign?.name || campaignId}" parada`);
    } else {
      console.log(`ℹ️ Campanha ${campaignId} não estava em execução`);
    }
  } catch (error) {
    console.error('Erro ao parar campanha:', error);
  }
}

async function executeCampaign(campaign) {
  try {
    const groups = JSON.parse(campaign.groups);
    
    // Buscar uma instância conectada para usar
    const instancesResult = await evolutionApi.listInstances();
    if (!instancesResult.success || !instancesResult.data.length) {
      throw new Error('Nenhuma instância disponível para envio');
    }
    
    // Encontrar uma instância conectada
    const connectedInstance = instancesResult.data.find(instance => 
      instance.connectionStatus === 'open' || instance.connectionStatus === 'connected'
    );
    
    if (!connectedInstance) {
      throw new Error('Nenhuma instância conectada encontrada');
    }
    
    console.log(`📱 Usando instância: ${connectedInstance.instanceName} (${connectedInstance.connectionStatus})`);
    
    for (const groupId of groups) {
      try {
        // Construir URL completa para mídia se houver
        let mediaUrl = null;
        if (campaign.mediaPath) {
          // Usar a URL do servidor configurada nas variáveis de ambiente
          const serverUrl = process.env.SERVER_URL || process.env.BACKEND_URL || 'http://localhost:3001';
          mediaUrl = `${serverUrl}${campaign.mediaPath}`;
          console.log(`📁 URL da mídia: ${mediaUrl}`);
        }

        const result = await evolutionApi.sendMessage(
          connectedInstance.instanceName,
          groupId,
          campaign.content,
          mediaUrl,
          campaign.type
        );

        // Buscar o nome do grupo para melhor registro
        let groupName = groupId;
        try {
          const groups = await evolutionApi.getGroups(connectedInstance.instanceName);
          const group = groups.find(g => g.id === groupId);
          groupName = group ? group.name : groupId;
        } catch (groupError) {
          console.log(`⚠️ Não foi possível buscar nome do grupo ${groupId}`);
        }

        await prisma.messageLog.create({
          data: {
            campaignId: campaign.id,
            groupId: groupId,
            groupName: groupName,
            status: result.success ? 'SUCCESS' : 'ERROR',
            message: result.success ? 'Mensagem enviada com sucesso' : result.error
          }
        });

        if (result.success) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              totalSent: { increment: 1 },
              lastSent: new Date()
            }
          });
          console.log(`✅ Envio registrado para campanha "${campaign.name}"`);
        }

        console.log(`📤 Mensagem enviada para ${groupName} (${groupId}): ${result.success ? '✅ Sucesso' : '❌ Erro - ' + result.error}`);
        
        // Aguardar entre mensagens para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${groupId}:`, error.message);
        await prisma.messageLog.create({
          data: {
            campaignId: campaign.id,
            groupId: groupId,
            groupName: groupId,
            status: 'ERROR',
            message: error.message
          }
        });
      }
    }
    
    // Enviar relatório automático para o dono da instância após todos os envios
    if (connectedInstance) {
      console.log(`📊 Enviando relatório para o dono da instância...`);
      await reportService.sendCampaignReport(campaign, connectedInstance.instanceName);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao executar campanha "${campaign.name}":`, error.message);
    
    // Se for erro de instância, pausar a campanha
    if (error.message.includes('instância')) {
      try {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' }
        });
        console.log(`⏸️ Campanha "${campaign.name}" pausada devido a erro de instância`);
      } catch (updateError) {
        console.error('Erro ao pausar campanha:', updateError);
      }
    }
  }
}

async function startCronJobs() {
  try {
    const activeCampaignsFromDb = await prisma.campaign.findMany({
      where: { status: 'ACTIVE' }
    });

    for (const campaign of activeCampaignsFromDb) {
      await scheduleCampaign(campaign);
    }

    console.log(`🔄 ${activeCampaignsFromDb.length} campanhas ativas carregadas`);
  } catch (error) {
    console.error('Erro ao iniciar cron jobs:', error);
  }
}

// Função para obter informações das campanhas ativas
async function getActiveCampaignsInfo() {
  try {
    const activeCampaignsFromDb = await prisma.campaign.findMany({
      where: { status: 'ACTIVE' }
    });

    const campaignsInfo = activeCampaignsFromDb.map(campaign => {
      let nextExecution = null;
      const now = new Date();
      
      if (campaign.interval) {
        const lastSent = campaign.lastSent ? new Date(campaign.lastSent) : now;
        const nextTime = new Date(lastSent.getTime() + (campaign.interval * 1000));
        
        // Se o próximo horário já passou, calcular o próximo baseado no agora
        if (nextTime <= now) {
          // Calcular quantos intervalos se passaram desde o último envio
          const timeSinceLastSent = now.getTime() - lastSent.getTime();
          const intervalsPassed = Math.floor(timeSinceLastSent / (campaign.interval * 1000));
          const nextInterval = intervalsPassed + 1;
          nextExecution = new Date(lastSent.getTime() + (nextInterval * campaign.interval * 1000));
        } else {
          nextExecution = nextTime;
        }
      } else if (campaign.scheduledTime) {
        const scheduled = new Date(campaign.scheduledTime);
        if (scheduled > now) {
          nextExecution = scheduled;
        }
      }

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        interval: campaign.interval,
        scheduledTime: campaign.scheduledTime,
        lastSent: campaign.lastSent,
        nextExecution: nextExecution,
        isRunning: activeCampaigns.has(campaign.id)
      };
    });

    return campaignsInfo;
  } catch (error) {
    console.error('Erro ao obter informações das campanhas:', error);
    return [];
  }
}

module.exports = {
  scheduleCampaign,
  stopCampaign,
  startCronJobs,
  getActiveCampaignsInfo
};