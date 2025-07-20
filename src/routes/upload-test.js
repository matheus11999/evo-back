const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Garantir que o diretório uploads existe
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Diretório uploads criado para teste:', uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `test-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
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

// Middleware para tratar erros do multer
const handleMulterError = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
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

// Endpoint para testar upload
router.post('/test', authMiddleware, handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path,
      url: `/uploads/${req.file.filename}`,
      uploadTime: new Date().toISOString()
    };

    console.log('✅ Upload de teste realizado:', fileInfo);

    res.json({
      success: true,
      message: 'Upload realizado com sucesso',
      file: fileInfo
    });

  } catch (error) {
    console.error('❌ Erro no upload de teste:', error);
    res.status(500).json({ 
      error: 'Erro interno no upload',
      details: error.message 
    });
  }
});

// Endpoint para verificar diretórios
router.get('/check-directories', authMiddleware, (req, res) => {
  try {
    const directories = {
      uploads: {
        path: uploadsDir,
        exists: fs.existsSync(uploadsDir),
        writable: false
      },
      logs: {
        path: path.join(__dirname, '../../logs'),
        exists: fs.existsSync(path.join(__dirname, '../../logs')),
        writable: false
      },
      prisma: {
        path: path.join(__dirname, '../../prisma'),
        exists: fs.existsSync(path.join(__dirname, '../../prisma')),
        writable: false
      }
    };

    // Testar permissões de escrita
    Object.keys(directories).forEach(key => {
      try {
        const testFile = path.join(directories[key].path, '.test-write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        directories[key].writable = true;
      } catch (err) {
        directories[key].writeError = err.message;
      }
    });

    res.json({
      success: true,
      directories,
      workingDirectory: process.cwd()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Erro ao verificar diretórios',
      details: error.message
    });
  }
});

module.exports = router;