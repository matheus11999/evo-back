const express = require('express');
const authMiddleware = require('../middleware/auth');
const evolutionApi = require('../services/evolutionApi');
const prisma = require('../utils/prisma');

const router = express.Router();

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const apiStatus = await evolutionApi.testConnection();
    
    const activeCampaigns = await prisma.campaign.count({
      where: { status: 'ACTIVE' }
    });

    const lastLog = await prisma.messageLog.findFirst({
      orderBy: { sentAt: 'desc' },
      include: { campaign: true }
    });

    const config = await prisma.config.findFirst();

    // Buscar instâncias se a API estiver funcionando
    let instances = [];
    if (apiStatus.success) {
      const instancesResult = await evolutionApi.listInstances();
      if (instancesResult.success) {
        instances = instancesResult.data;
      }
    }

    res.json({
      evolutionApi: apiStatus,
      activeCampaigns,
      lastSent: lastLog ? {
        campaignName: lastLog.campaign.name,
        groupName: lastLog.groupName,
        sentAt: lastLog.sentAt,
        status: lastLog.status
      } : null,
      timezone: config?.timezone || 'America/Sao_Paulo',
      totalLogs: await prisma.messageLog.count(),
      instances: instances
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar status do dashboard' });
  }
});

// Criar nova instância
router.post('/create-instance', authMiddleware, async (req, res) => {
  try {
    const { instanceName, phoneNumber } = req.body;
    
    if (!instanceName) {
      return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório' });
    }

    // Verificar se já existe no banco
    const existingInstance = await prisma.instance.findUnique({
      where: { instanceName }
    });

    if (existingInstance) {
      return res.status(400).json({ error: 'Instância já existe' });
    }

    // Criar na Evolution API
    const result = await evolutionApi.createInstance(instanceName, phoneNumber);
    
    if (result.success) {
      // Salvar no banco de dados local
      await prisma.instance.create({
        data: {
          instanceName,
          phoneNumber,
          status: 'CONNECTING'
        }
      });
      
      console.log(`📱 Instância "${instanceName}" criada e salva no banco - Número: ${phoneNumber}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    res.status(500).json({ error: 'Erro ao criar instância' });
  }
});

// Buscar QR Code da instância
router.get('/qrcode/:instanceName', authMiddleware, async (req, res) => {
  try {
    const { instanceName } = req.params;
    const result = await evolutionApi.getQRCode(instanceName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar QR Code' });
  }
});

// Listar todas as instâncias
router.get('/instances', authMiddleware, async (req, res) => {
  try {
    const result = await evolutionApi.listInstances();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar instâncias' });
  }
});

// Status de uma instância específica
router.get('/instance/:instanceName/status', authMiddleware, async (req, res) => {
  try {
    const { instanceName } = req.params;
    const result = await evolutionApi.getInstanceStatus(instanceName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar status da instância' });
  }
});

// Deletar instância
router.delete('/instance/:instanceName', authMiddleware, async (req, res) => {
  try {
    const { instanceName } = req.params;
    
    // Deletar da Evolution API
    const result = await evolutionApi.deleteInstance(instanceName);
    
    // Deletar do banco de dados local
    try {
      await prisma.instance.delete({
        where: { instanceName }
      });
      console.log(`🗑️ Instância "${instanceName}" removida do banco`);
    } catch (dbError) {
      console.log(`⚠️ Instância "${instanceName}" não encontrada no banco ou já removida`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao deletar instância:', error);
    res.status(500).json({ error: 'Erro ao deletar instância' });
  }
});

module.exports = router;