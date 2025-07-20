const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const evolutionApi = require('../services/evolutionApi');

const router = express.Router();

// Configuração do multer para upload de mídia
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `test-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mp3|wav|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido para teste'));
    }
  }
});

// Enviar mensagem de texto de teste
router.post('/send-text', authMiddleware, async (req, res) => {
  try {
    const { instanceName, number, text } = req.body;
    
    // Validações
    if (!instanceName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome da instância é obrigatório' 
      });
    }

    if (!number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Número/ID do destinatário é obrigatório' 
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Texto da mensagem é obrigatório' 
      });
    }

    console.log(`🧪 [TESTE] Enviando mensagem de texto:`);
    console.log(`   Instância: ${instanceName}`);
    console.log(`   Destinatário: ${number}`);
    console.log(`   Texto: ${text}`);

    // Verificar se a instância está conectada
    const statusResult = await evolutionApi.getInstanceStatus(instanceName);
    if (!statusResult.success) {
      return res.status(400).json({
        success: false,
        error: `Erro ao verificar status da instância: ${statusResult.error}`
      });
    }

    const instanceState = statusResult.data?.instance?.state;
    if (instanceState !== 'open') {
      return res.status(400).json({
        success: false,
        error: `Instância não está conectada. Status atual: ${instanceState}`
      });
    }

    // Enviar mensagem
    const result = await evolutionApi.sendTextMessage(instanceName, number, text);
    
    if (result.success) {
      console.log(`✅ [TESTE] Mensagem enviada com sucesso`);
      res.json({
        success: true,
        message: 'Mensagem de teste enviada com sucesso',
        data: result.data
      });
    } else {
      console.log(`❌ [TESTE] Erro ao enviar mensagem: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ [TESTE] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor: ' + error.message 
    });
  }
});

// Enviar mensagem de mídia de teste
router.post('/send-media', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const { instanceName, number, caption } = req.body;
    
    // Validações
    if (!instanceName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome da instância é obrigatório' 
      });
    }

    if (!number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Número/ID do destinatário é obrigatório' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Arquivo de mídia é obrigatório' 
      });
    }

    console.log(`🧪 [TESTE] Enviando mensagem de mídia:`);
    console.log(`   Instância: ${instanceName}`);
    console.log(`   Destinatário: ${number}`);
    console.log(`   Arquivo: ${req.file.filename}`);
    console.log(`   Tipo: ${req.file.mimetype}`);
    console.log(`   Legenda: ${caption || 'Sem legenda'}`);

    // Verificar se a instância está conectada
    const statusResult = await evolutionApi.getInstanceStatus(instanceName);
    if (!statusResult.success) {
      return res.status(400).json({
        success: false,
        error: `Erro ao verificar status da instância: ${statusResult.error}`
      });
    }

    const instanceState = statusResult.data?.instance?.state;
    if (instanceState !== 'open') {
      return res.status(400).json({
        success: false,
        error: `Instância não está conectada. Status atual: ${instanceState}`
      });
    }

    // Determinar tipo de mídia
    let mediaType = 'document';
    if (req.file.mimetype.startsWith('image/')) {
      mediaType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      mediaType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    }

    // Construir URL da mídia
    const mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Enviar mensagem de mídia
    const result = await evolutionApi.sendMediaMessage(
      instanceName, 
      number, 
      mediaUrl, 
      caption || '', 
      mediaType
    );
    
    if (result.success) {
      console.log(`✅ [TESTE] Mídia enviada com sucesso`);
      res.json({
        success: true,
        message: 'Mídia de teste enviada com sucesso',
        data: result.data
      });
    } else {
      console.log(`❌ [TESTE] Erro ao enviar mídia: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ [TESTE] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor: ' + error.message 
    });
  }
});

// Enviar mensagem de localização de teste
router.post('/send-location', authMiddleware, async (req, res) => {
  try {
    const { instanceName, number, latitude, longitude, name, address } = req.body;
    
    // Validações
    if (!instanceName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome da instância é obrigatório' 
      });
    }

    if (!number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Número/ID do destinatário é obrigatório' 
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false, 
        error: 'Latitude e longitude são obrigatórias' 
      });
    }

    console.log(`🧪 [TESTE] Enviando localização:`);
    console.log(`   Instância: ${instanceName}`);
    console.log(`   Destinatário: ${number}`);
    console.log(`   Localização: ${latitude}, ${longitude}`);

    // Verificar se a instância está conectada
    const statusResult = await evolutionApi.getInstanceStatus(instanceName);
    if (!statusResult.success) {
      return res.status(400).json({
        success: false,
        error: `Erro ao verificar status da instância: ${statusResult.error}`
      });
    }

    const instanceState = statusResult.data?.instance?.state;
    if (instanceState !== 'open') {
      return res.status(400).json({
        success: false,
        error: `Instância não está conectada. Status atual: ${instanceState}`
      });
    }

    // Payload para localização
    const payload = {
      number: number,
      locationMessage: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        name: name || 'Localização de Teste',
        address: address || 'Endereço de teste'
      }
    };

    // Enviar localização usando o método makeRequest diretamente
    const response = await evolutionApi.makeRequest('POST', `/message/sendLocation/${instanceName}`, payload);
    
    console.log(`✅ [TESTE] Localização enviada com sucesso`);
    res.json({
      success: true,
      message: 'Localização de teste enviada com sucesso',
      data: response.data
    });

  } catch (error) {
    console.error('❌ [TESTE] Erro ao enviar localização:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor: ' + error.message 
    });
  }
});

// Listar instâncias disponíveis para teste
router.get('/instances', authMiddleware, async (req, res) => {
  try {
    const result = await evolutionApi.listInstances();
    
    if (result.success) {
      const instances = result.data.map(instance => ({
        instanceName: instance.instanceName,
        connectionStatus: instance.connectionStatus,
        isConnected: instance.connectionStatus === 'open' || instance.connectionStatus === 'connected'
      }));

      res.json({
        success: true,
        data: instances
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ [TESTE] Erro ao listar instâncias:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor: ' + error.message 
    });
  }
});

// Listar grupos de uma instância para teste
router.get('/groups/:instanceName', authMiddleware, async (req, res) => {
  try {
    const { instanceName } = req.params;
    
    if (!instanceName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome da instância é obrigatório' 
      });
    }

    console.log(`🧪 [TESTE] Buscando grupos da instância: ${instanceName}`);

    const groups = await evolutionApi.getGroups(instanceName);
    
    console.log(`✅ [TESTE] Encontrados ${groups.length} grupos`);
    
    res.json({
      success: true,
      data: groups
    });

  } catch (error) {
    console.error('❌ [TESTE] Erro ao buscar grupos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor: ' + error.message 
    });
  }
});

module.exports = router;