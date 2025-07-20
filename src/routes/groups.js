const express = require('express');
const authMiddleware = require('../middleware/auth');
const evolutionApi = require('../services/evolutionApi');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { instance } = req.query;
    
    if (!instance) {
      return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }
    
    const groups = await evolutionApi.getGroups(instance);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;