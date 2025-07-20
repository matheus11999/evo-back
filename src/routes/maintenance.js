const express = require('express');
const authMiddleware = require('../middleware/auth');
const maintenanceService = require('../services/maintenanceService');

const router = express.Router();

// Health check do sistema
router.get('/health', authMiddleware, async (req, res) => {
  try {
    const health = await maintenanceService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar saúde do sistema' });
  }
});

// Relatório do sistema
router.get('/report', authMiddleware, async (req, res) => {
  try {
    const report = await maintenanceService.generateSystemReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatório do sistema' });
  }
});

// Limpeza manual de logs
router.post('/cleanup', authMiddleware, async (req, res) => {
  try {
    const result = await maintenanceService.forceCleanup();
    res.json({
      success: true,
      message: 'Limpeza executada com sucesso',
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao executar limpeza' });
  }
});

// Otimização manual do banco
router.post('/optimize', authMiddleware, async (req, res) => {
  try {
    await maintenanceService.optimizeDatabase();
    res.json({
      success: true,
      message: 'Banco de dados otimizado com sucesso'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao otimizar banco de dados' });
  }
});

// Verificação manual de integridade
router.post('/integrity-check', authMiddleware, async (req, res) => {
  try {
    await maintenanceService.checkCampaignIntegrity();
    res.json({
      success: true,
      message: 'Verificação de integridade executada'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro na verificação de integridade' });
  }
});

module.exports = router;