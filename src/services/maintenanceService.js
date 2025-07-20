const cron = require('node-cron');
const prisma = require('../utils/prisma');

class MaintenanceService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Inicializa tarefas de manutenção automática
   */
  init() {
    if (this.isInitialized) {
      console.log('⚠️ Serviço de manutenção já inicializado');
      return;
    }

    try {
      // Limpeza diária de logs antigos - todo dia às 2:00 AM
      cron.schedule('0 2 * * *', async () => {
        console.log('🧹 Iniciando limpeza automática de logs antigos...');
        await this.cleanupOldLogs();
      });

      // Limpeza semanal de logs da API - todo domingo às 3:00 AM
      cron.schedule('0 3 * * 0', async () => {
        console.log('🧹 Iniciando limpeza semanal de logs da API...');
        await this.cleanupApiLogs();
      });

      // Verificação de integridade de campanhas - a cada 30 minutos
      cron.schedule('*/30 * * * *', async () => {
        await this.checkCampaignIntegrity();
      });

      // Relatório de status do sistema - todo dia às 8:00 AM
      cron.schedule('0 8 * * *', async () => {
        await this.generateSystemReport();
      });

      // Otimização de banco de dados - toda segunda às 4:00 AM
      cron.schedule('0 4 * * 1', async () => {
        console.log('🗄️ Iniciando otimização do banco de dados...');
        await this.optimizeDatabase();
      });

      this.isInitialized = true;
      console.log('✅ Serviço de manutenção inicializado com sucesso');
      console.log('📋 Tarefas agendadas:');
      console.log('   • Limpeza de logs: diária às 2:00');
      console.log('   • Limpeza API logs: semanal aos domingos às 3:00');
      console.log('   • Verificação campanhas: a cada 30 minutos');
      console.log('   • Relatório sistema: diário às 8:00');
      console.log('   • Otimização BD: segundas às 4:00');

    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de manutenção:', error);
    }
  }

  /**
   * Limpa logs de mensagens antigos (mais de 30 dias)
   */
  async cleanupOldLogs() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.messageLog.deleteMany({
        where: {
          sentAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      if (result.count > 0) {
        console.log(`🧹 Removidos ${result.count} logs de mensagens antigos (>30 dias)`);
      } else {
        console.log('✅ Nenhum log antigo encontrado para remoção');
      }

      return result.count;
    } catch (error) {
      console.error('❌ Erro ao limpar logs antigos:', error);
      return 0;
    }
  }

  /**
   * Limpa logs da API antigos (mais de 7 dias)
   */
  async cleanupApiLogs() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await prisma.apiLog.deleteMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo
          }
        }
      });

      if (result.count > 0) {
        console.log(`🧹 Removidos ${result.count} logs da API antigos (>7 dias)`);
      } else {
        console.log('✅ Nenhum log da API antigo encontrado para remoção');
      }

      return result.count;
    } catch (error) {
      console.error('❌ Erro ao limpar logs da API:', error);
      return 0;
    }
  }

  /**
   * Verifica integridade das campanhas e corrige problemas
   */
  async checkCampaignIntegrity() {
    try {
      // Verificar campanhas órfãs (sem instância válida)
      const campaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE' }
      });

      let issues = 0;

      for (const campaign of campaigns) {
        // Verificar se a instância ainda existe
        if (campaign.instance) {
          const instance = await prisma.instance.findUnique({
            where: { instanceName: campaign.instance }
          });

          if (!instance) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: 'PAUSED' }
            });
            console.log(`⚠️ Campanha "${campaign.name}" pausada - instância "${campaign.instance}" não encontrada`);
            issues++;
          }
        }

        // Verificar campanhas muito antigas sem envios
        const daysSinceLastSent = campaign.lastSent 
          ? Math.floor((new Date() - new Date(campaign.lastSent)) / (1000 * 60 * 60 * 24))
          : null;

        if (daysSinceLastSent && daysSinceLastSent > 7) {
          console.log(`⚠️ Campanha "${campaign.name}" sem envios há ${daysSinceLastSent} dias`);
        }
      }

      if (issues === 0) {
        console.log('✅ Verificação de integridade: todas as campanhas estão em ordem');
      }

    } catch (error) {
      console.error('❌ Erro na verificação de integridade:', error);
    }
  }

  /**
   * Gera relatório de status do sistema
   */
  async generateSystemReport() {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Estatísticas gerais
      const totalCampaigns = await prisma.campaign.count();
      const activeCampaigns = await prisma.campaign.count({ where: { status: 'ACTIVE' } });
      const totalInstances = await prisma.instance.count();

      // Estatísticas das últimas 24h
      const last24hLogs = await prisma.messageLog.count({
        where: { sentAt: { gte: yesterday } }
      });

      const last24hSuccess = await prisma.messageLog.count({
        where: { 
          sentAt: { gte: yesterday },
          status: 'SUCCESS'
        }
      });

      const last24hErrors = await prisma.messageLog.count({
        where: { 
          sentAt: { gte: yesterday },
          status: 'ERROR'
        }
      });

      // Tamanho do banco de dados (estimativa)
      const totalLogs = await prisma.messageLog.count();
      const totalApiLogs = await prisma.apiLog.count();

      const successRate = last24hLogs > 0 ? ((last24hSuccess / last24hLogs) * 100).toFixed(1) : 0;

      console.log(`
📊 RELATÓRIO DIÁRIO DO SISTEMA - ${now.toLocaleDateString('pt-BR')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 ESTATÍSTICAS GERAIS:
   • Total de campanhas: ${totalCampaigns}
   • Campanhas ativas: ${activeCampaigns}
   • Instâncias registradas: ${totalInstances}

📤 ÚLTIMAS 24 HORAS:
   • Mensagens enviadas: ${last24hLogs}
   • Sucessos: ${last24hSuccess}
   • Erros: ${last24hErrors}
   • Taxa de sucesso: ${successRate}%

🗄️ BANCO DE DADOS:
   • Total de logs: ${totalLogs}
   • Logs da API: ${totalApiLogs}
   • Uso de memória: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);

      return {
        totalCampaigns,
        activeCampaigns,
        totalInstances,
        last24hLogs,
        last24hSuccess,
        last24hErrors,
        successRate,
        totalLogs,
        totalApiLogs
      };

    } catch (error) {
      console.error('❌ Erro ao gerar relatório do sistema:', error);
      return null;
    }
  }

  /**
   * Otimiza o banco de dados SQLite
   */
  async optimizeDatabase() {
    try {
      // Para SQLite, podemos executar VACUUM para otimizar
      await prisma.$executeRaw`VACUUM;`;
      console.log('✅ Banco de dados otimizado com sucesso');

      // Também podemos analisar e recriar índices se necessário
      await prisma.$executeRaw`ANALYZE;`;
      console.log('✅ Análise de índices concluída');

    } catch (error) {
      console.error('❌ Erro ao otimizar banco de dados:', error);
    }
  }

  /**
   * Força limpeza manual (para uso em desenvolvimento/testes)
   */
  async forceCleanup() {
    console.log('🧹 Iniciando limpeza manual...');
    const logsRemoved = await this.cleanupOldLogs();
    const apiLogsRemoved = await this.cleanupApiLogs();
    await this.optimizeDatabase();
    
    return {
      logsRemoved,
      apiLogsRemoved
    };
  }

  /**
   * Verifica saúde do sistema
   */
  async healthCheck() {
    try {
      // Testar conexão com banco
      await prisma.campaign.count();
      
      // Verificar uso de memória
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = {
        rss: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        external: (memoryUsage.external / 1024 / 1024).toFixed(2)
      };

      // Verificar campanhas ativas
      const activeCampaigns = await prisma.campaign.count({ where: { status: 'ACTIVE' } });

      return {
        status: 'healthy',
        database: 'connected',
        memory: memoryUsageMB,
        activeCampaigns,
        uptime: process.uptime()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new MaintenanceService();