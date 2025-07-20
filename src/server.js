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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Inicializar aplicação com banco de dados
async function startServer() {
  try {
    // Inicializar banco de dados primeiro
    await initializeDatabase();
    
    app.listen(PORT, async () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      
      // Inicializar serviços após o banco estar pronto
      try {
        await startCronJobs();
        await maintenanceService.init();
      } catch (error) {
        console.error('⚠️ Erro ao inicializar serviços:', error.message);
        console.log('🔄 Serviços serão inicializados posteriormente...');
      }
    });
    
  } catch (error) {
    console.error('❌ Falha ao inicializar servidor:', error.message);
    process.exit(1);
  }
}

startServer();