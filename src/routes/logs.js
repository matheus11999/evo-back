const express = require('express');
const authMiddleware = require('../middleware/auth');
const prisma = require('../utils/prisma');
const ApiLogger = require('../utils/apiLogger');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      campaignId, 
      status,
      startDate,
      endDate 
    } = req.query;

    const where = {};
    
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = new Date(startDate);
      if (endDate) where.sentAt.lte = new Date(endDate);
    }

    const logs = await prisma.messageLog.findMany({
      where,
      include: {
        campaign: {
          select: { name: true }
        }
      },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.messageLog.count({ where });

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { format = 'json', campaignId } = req.query;
    
    const where = campaignId ? { campaignId } : {};
    
    const logs = await prisma.messageLog.findMany({
      where,
      include: {
        campaign: {
          select: { name: true }
        }
      },
      orderBy: { sentAt: 'desc' }
    });

    if (format === 'csv') {
      const csv = [
        'Data,Campanha,Grupo,Status,Mensagem',
        ...logs.map(log => 
          `${log.sentAt.toISOString()},${log.campaign.name},${log.groupName},${log.status},"${log.message || ''}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
      res.send(csv);
    } else {
      res.json(logs);
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao exportar logs' });
  }
});

// API Logs routes
router.get('/api', authMiddleware, async (req, res) => {
  try {
    const filters = req.query;
    const result = await ApiLogger.getLogs(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await prisma.apiLog.groupBy({
      by: ['method', 'responseStatus'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    const instances = await prisma.apiLog.groupBy({
      by: ['instanceName'],
      _count: {
        id: true
      },
      where: {
        instanceName: {
          not: null
        }
      }
    });

    const endpoints = await prisma.apiLog.groupBy({
      by: ['endpoint'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    res.json({
      stats,
      instances,
      endpoints
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

router.delete('/api/clear', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const deletedCount = await ApiLogger.clearOldLogs(parseInt(days));
    res.json({ success: true, deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao limpar logs' });
  }
});

// Clear all message logs
router.delete('/clear', authMiddleware, async (req, res) => {
  try {
    const deletedCount = await prisma.messageLog.deleteMany({});
    res.json({ 
      success: true, 
      deletedCount: deletedCount.count,
      message: 'Todos os logs foram removidos com sucesso'
    });
  } catch (error) {
    console.error('Erro ao limpar todos os logs:', error);
    res.status(500).json({ error: 'Erro ao limpar logs' });
  }
});

// Clear all API logs
router.delete('/api/clear-all', authMiddleware, async (req, res) => {
  try {
    const deletedCount = await prisma.apiLog.deleteMany({});
    res.json({ 
      success: true, 
      deletedCount: deletedCount.count,
      message: 'Todos os logs da API foram removidos com sucesso'
    });
  } catch (error) {
    console.error('Erro ao limpar todos os logs da API:', error);
    res.status(500).json({ error: 'Erro ao limpar logs da API' });
  }
});

module.exports = router;