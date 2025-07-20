const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const groupRoutes = require('./routes/groups');
const configRoutes = require('./routes/config');
const dashboardRoutes = require('./routes/dashboard');
const logRoutes = require('./routes/logs');
const maintenanceRoutes = require('./routes/maintenance');
const uploadTestRoutes = require('./routes/upload-test');

const { startCronJobs } = require('./services/cronService');
const maintenanceService = require('./services/maintenanceService');
const { initializeDatabase } = require('./utils/dbInit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/upload', uploadTestRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Inicializar aplicação com banco de dados
async function startServer() {
  try {
    // Tentar inicializar banco de dados
    try {
      await initializeDatabase();
      console.log('✅ Database initialized successfully');
    } catch (dbError) {
      console.error('⚠️ Database initialization failed:', dbError.message);
      console.log('🔄 Starting server without database initialization...');
      console.log('📝 Database will be initialized on first use');
    }
    
    app.listen(PORT, async () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Acesse: http://localhost:${PORT}`);
      
      // Inicializar serviços após o servidor estar rodando
      setTimeout(async () => {
        try {
          console.log('🔄 Inicializando serviços...');
          await startCronJobs();
          await maintenanceService.init();
          console.log('✅ Serviços inicializados com sucesso');
        } catch (error) {
          console.error('⚠️ Erro ao inicializar serviços:', error.message);
          console.log('🔄 Serviços podem ser inicializados manualmente se necessário');
        }
      }, 2000); // Aguardar 2 segundos antes de iniciar serviços
    });
    
  } catch (error) {
    console.error('❌ Falha crítica ao inicializar servidor:', error.message);
    console.log('🔄 Tentando iniciar servidor básico...');
    
    // Fallback: iniciar servidor sem inicializações extras
    app.listen(PORT, () => {
      console.log(`🚀 Servidor básico rodando na porta ${PORT}`);
      console.log('⚠️ Algumas funcionalidades podem não estar disponíveis');
    });
  }
}

startServer();