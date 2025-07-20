const prisma = require('./prisma');

class ApiLogger {
  static async logRequest(config, response, error = null, responseTime = 0) {
    try {
      const url = new URL(config.url, config.baseURL || '');
      const endpoint = url.pathname;
      
      // Extrair nome da instância da URL se possível
      const instanceMatch = endpoint.match(/\/([\w-]+)(?:\/|$)/);
      const instanceName = instanceMatch ? instanceMatch[1] : null;
      
      // Preparar dados para log
      const logData = {
        method: config.method.toUpperCase(),
        url: url.toString(),
        endpoint,
        requestBody: config.data ? JSON.stringify(config.data) : null,
        requestHeaders: JSON.stringify({
          'Content-Type': config.headers['Content-Type'],
          'apikey': config.headers.apikey ? '[HIDDEN]' : undefined
        }),
        responseStatus: response?.status || (error?.response?.status || 0),
        responseBody: response?.data ? JSON.stringify(response.data) : (error?.response?.data ? JSON.stringify(error.response.data) : null),
        responseTime,
        instanceName,
        error: error ? error.message : null
      };
      
      // Salvar no banco
      await prisma.apiLog.create({
        data: logData
      });
      
      console.log(`📋 API Log: ${logData.method} ${logData.endpoint} - ${logData.responseStatus} (${responseTime}ms)`);
      
    } catch (logError) {
      console.error('Erro ao salvar log da API:', logError);
    }
  }
  
  static async getLogs(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        method,
        endpoint,
        instanceName,
        status,
        startDate,
        endDate
      } = filters;
      
      const where = {};
      
      if (method) where.method = method;
      if (endpoint) where.endpoint = { contains: endpoint };
      if (instanceName) where.instanceName = instanceName;
      if (status) where.responseStatus = parseInt(status);
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }
      
      const logs = await prisma.apiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit)
      });
      
      const total = await prisma.apiLog.count({ where });
      
      return {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      throw new Error('Erro ao buscar logs: ' + error.message);
    }
  }
  
  static async clearOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const deleted = await prisma.apiLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });
      
      console.log(`🗑️ Removidos ${deleted.count} logs antigos`);
      return deleted.count;
      
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
      return 0;
    }
  }
}

module.exports = ApiLogger;