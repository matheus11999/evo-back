const express = require('express');
const authMiddleware = require('../middleware/auth');
const evolutionApi = require('../services/evolutionApi');
const prisma = require('../utils/prisma');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    let config = await prisma.config.findFirst();
    
    if (!config) {
      config = await prisma.config.create({
        data: {
          evolutionUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
          evolutionKey: process.env.EVOLUTION_API_KEY || '',
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR'
        }
      });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { evolutionUrl, evolutionKey, timezone, language } = req.body;

    let config = await prisma.config.findFirst();

    if (config) {
      config = await prisma.config.update({
        where: { id: config.id },
        data: { evolutionUrl, evolutionKey, timezone, language }
      });
    } else {
      config = await prisma.config.create({
        data: { evolutionUrl, evolutionKey, timezone, language }
      });
    }

    await evolutionApi.updateConfig();

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// Backup database
router.get('/backup', authMiddleware, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const dbPath = path.join(__dirname, '../../prisma/dev.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Banco de dados não encontrado' });
    }
    
    const stats = fs.statSync(dbPath);
    const filename = `backup-${new Date().toISOString().split('T')[0]}.db`;
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Erro ao fazer backup:', error);
    res.status(500).json({ error: 'Erro ao gerar backup' });
  }
});

module.exports = router;