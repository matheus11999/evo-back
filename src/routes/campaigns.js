const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const prisma = require('../utils/prisma');
const { scheduleCampaign, stopCampaign, getActiveCampaignsInfo } = require('../services/cronService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { logs: true }
        }
      }
    });

    // Adicionar informações de execução para campanhas ativas
    const activeCampaignsInfo = await getActiveCampaignsInfo();
    const activeCampaignsMap = new Map(activeCampaignsInfo.map(info => [info.id, info]));

    const campaignsWithInfo = campaigns.map(campaign => ({
      ...campaign,
      nextExecution: activeCampaignsMap.get(campaign.id)?.nextExecution || null,
      isRunning: activeCampaignsMap.get(campaign.id)?.isRunning || false
    }));

    res.json(campaignsWithInfo);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar campanhas' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        logs: {
          orderBy: { sentAt: 'desc' },
          take: 50
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar campanha' });
  }
});

// Middleware para tratar erros do multer
const handleMulterError = (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo muito grande. Limite: 10MB' });
        }
        return res.status(400).json({ error: 'Erro no upload: ' + err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post('/', authMiddleware, handleMulterError, async (req, res) => {
  try {
    const { name, type, content, groups, interval, scheduledTime } = req.body;
    
    // Validação básica
    if (!name || !type || !content || !groups) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, type, content, groups' });
    }
    
    const mediaPath = req.file ? `/uploads/${req.file.filename}` : null;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type,
        content,
        mediaPath,
        groups,
        interval: interval ? parseInt(interval) : null,
        scheduledTime
      }
    });

    res.json(campaign);
  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    res.status(500).json({ error: 'Erro ao criar campanha', details: error.message });
  }
});

router.put('/:id', authMiddleware, handleMulterError, async (req, res) => {
  try {
    const { name, type, content, groups, interval, scheduledTime } = req.body;
    
    const updateData = {
      name,
      type,
      content,
      groups,
      interval: interval ? parseInt(interval) : null,
      scheduledTime
    };

    if (req.file) {
      updateData.mediaPath = `/uploads/${req.file.filename}`;
    }

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status }
    });

    if (status === 'ACTIVE') {
      await scheduleCampaign(campaign);
    } else {
      await stopCampaign(campaign.id);
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status da campanha' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await stopCampaign(req.params.id);
    
    await prisma.campaign.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar campanha' });
  }
});

module.exports = router;