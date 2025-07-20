const prisma = require('../utils/prisma');
const evolutionApi = require('./evolutionApi');

class ReportService {
  /**
   * Envia relatório automático para o dono da instância após cada envio de campanha
   */
  async sendCampaignReport(campaign, instanceName) {
    try {
      // Buscar o número do dono da instância no banco
      let instance = null;
      try {
        instance = await prisma.instance.findUnique({
          where: { instanceName }
        });
      } catch (error) {
        console.log(`⚠️ Tabela Instance não encontrada ou erro na consulta: ${error.message}`);
        console.log(`📝 Para habilitar relatórios automáticos, recrie suas instâncias no InstanceManager`);
        return;
      }

      if (!instance || !instance.phoneNumber || instance.phoneNumber === '0000000000000') {
        console.log(`⚠️ Número do dono da instância ${instanceName} não configurado, pulando relatório`);
        console.log(`📝 Para receber relatórios, recrie a instância "${instanceName}" no InstanceManager`);
        return;
      }

      const instanceOwnerNumber = instance.phoneNumber;

      // Buscar estatísticas da campanha
      const stats = await this.getCampaignStats(campaign.id);
      
      // Buscar próximo envio
      const nextExecution = await this.getNextExecution(campaign);
      
      // Buscar envios de hoje
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      const todayLogs = await prisma.messageLog.count({
        where: {
          campaignId: campaign.id,
          sentAt: {
            gte: todayStart,
            lte: todayEnd
          }
        }
      });

      // Montar mensagem do relatório
      const reportMessage = this.formatReportMessage(campaign, stats, todayLogs, nextExecution);
      
      // Enviar relatório para o dono da instância
      const result = await evolutionApi.sendTextMessage(instanceName, instanceOwnerNumber, reportMessage);
      
      if (result.success) {
        console.log(`📊 Relatório enviado para o dono da instância ${instanceName}`);
        
        // Registrar o envio do relatório nos logs (opcional)
        await prisma.messageLog.create({
          data: {
            campaignId: campaign.id,
            groupId: instanceOwnerNumber,
            groupName: 'Relatório - Dono da Instância',
            status: 'SUCCESS',
            message: 'Relatório de campanha enviado'
          }
        });
      } else {
        console.error(`❌ Erro ao enviar relatório: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao enviar relatório de campanha:', error);
    }
  }

  /**
   * Busca estatísticas da campanha
   */
  async getCampaignStats(campaignId) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          logs: {
            select: {
              status: true,
              sentAt: true
            }
          }
        }
      });

      if (!campaign) return null;

      const groups = JSON.parse(campaign.groups || '[]');
      const totalGroups = groups.length;
      const successCount = campaign.logs.filter(log => log.status === 'SUCCESS').length;
      const errorCount = campaign.logs.filter(log => log.status === 'ERROR').length;
      const successRate = totalGroups > 0 ? ((successCount / totalGroups) * 100).toFixed(1) : 0;

      return {
        totalGroups,
        successCount,
        errorCount,
        successRate,
        totalSent: campaign.totalSent || 0,
        lastSent: campaign.lastSent
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas da campanha:', error);
      return null;
    }
  }

  /**
   * Calcula próximo horário de execução
   */
  async getNextExecution(campaign) {
    try {
      if (!campaign.interval && !campaign.scheduledTime) {
        return 'Não agendado';
      }

      const now = new Date();

      if (campaign.interval) {
        const lastSent = campaign.lastSent ? new Date(campaign.lastSent) : now;
        const nextTime = new Date(lastSent.getTime() + (campaign.interval * 1000));
        
        if (nextTime <= now) {
          const timeSinceLastSent = now.getTime() - lastSent.getTime();
          const intervalsPassed = Math.floor(timeSinceLastSent / (campaign.interval * 1000));
          const nextInterval = intervalsPassed + 1;
          const nextExecution = new Date(lastSent.getTime() + (nextInterval * campaign.interval * 1000));
          return this.formatDateTime(nextExecution);
        } else {
          return this.formatDateTime(nextTime);
        }
      } else if (campaign.scheduledTime) {
        return campaign.scheduledTime;
      }

      return 'Não definido';
    } catch (error) {
      console.error('Erro ao calcular próximo envio:', error);
      return 'Erro ao calcular';
    }
  }

  /**
   * Formata mensagem do relatório
   */
  formatReportMessage(campaign, stats, todayLogs, nextExecution) {
    const now = new Date();
    const timeFormatted = this.formatDateTime(now);
    
    return `🎯 *ENVIADO COM SUCESSO!*

📊 *RELATÓRIO DA CAMPANHA*
━━━━━━━━━━━━━━━━━━━━━━━

📝 *NOME DA CAMPANHA:* ${campaign.name}

👥 *TOTAL DE GRUPOS:* ${stats?.totalGroups || 0}

⏰ *HORÁRIO DE ENVIO:* ${timeFormatted}

📈 *TOTAL DE ENVIOS HOJE:* ${todayLogs}

⏭️ *PRÓXIMO ENVIO:* ${nextExecution}

✅ *SUCESSOS:* ${stats?.successCount || 0}
❌ *ERROS:* ${stats?.errorCount || 0}
📊 *TAXA DE SUCESSO:* ${stats?.successRate || 0}%

━━━━━━━━━━━━━━━━━━━━━━━
🤖 *WhatsApp Sender v1.0*`;
  }

  /**
   * Formata data e hora no padrão brasileiro
   */
  formatDateTime(date) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Sao_Paulo'
    }).format(date);
  }

  /**
   * Envia relatório diário consolidado (opcional)
   */
  async sendDailySummary(instanceName, instanceOwnerNumber) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Buscar estatísticas do dia
      const dailyLogs = await prisma.messageLog.findMany({
        where: {
          sentAt: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          campaign: {
            select: {
              name: true
            }
          }
        }
      });

      const totalMessages = dailyLogs.length;
      const successMessages = dailyLogs.filter(log => log.status === 'SUCCESS').length;
      const errorMessages = dailyLogs.filter(log => log.status === 'ERROR').length;
      const campaignsUsed = [...new Set(dailyLogs.map(log => log.campaign.name))];

      const summaryMessage = `📅 *RESUMO DIÁRIO*
━━━━━━━━━━━━━━━━━━━━━━━

📊 *ESTATÍSTICAS DE HOJE*
💬 Total de mensagens: ${totalMessages}
✅ Sucessos: ${successMessages}
❌ Erros: ${errorMessages}
📈 Taxa de sucesso: ${totalMessages > 0 ? ((successMessages / totalMessages) * 100).toFixed(1) : 0}%

🎯 *CAMPANHAS UTILIZADAS:*
${campaignsUsed.length > 0 ? campaignsUsed.map(name => `• ${name}`).join('\n') : 'Nenhuma campanha executada hoje'}

━━━━━━━━━━━━━━━━━━━━━━━
🤖 *WhatsApp Sender v1.0*`;

      const result = await evolutionApi.sendTextMessage(instanceName, instanceOwnerNumber, summaryMessage);
      
      if (result.success) {
        console.log(`📊 Resumo diário enviado para ${instanceName}`);
      }

    } catch (error) {
      console.error('Erro ao enviar resumo diário:', error);
    }
  }
}

module.exports = new ReportService();