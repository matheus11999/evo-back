/**
 * Script para detectar ambiente e configurar variáveis automaticamente
 */
const fs = require('fs');
const path = require('path');

function detectEnvironment() {
  console.log('🔍 Detectando ambiente de execução...');
  
  // Verificar se estamos em um container Docker
  const isDocker = fs.existsSync('/.dockerenv') || 
                   fs.existsSync('/proc/1/cgroup') && 
                   fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
  
  // Verificar se volume /data está montado
  const hasDataVolume = fs.existsSync('/data') && 
                        fs.statSync('/data').isDirectory();
  
  // Verificar se estamos no Easypanel (ou similar)
  const isEasypanel = process.env.NODE_ENV === 'production' && 
                     (hasDataVolume || process.env.EASYPANEL === 'true');
  
  console.log(`🐳 Docker: ${isDocker ? '✅' : '❌'}`);
  console.log(`📁 Volume /data: ${hasDataVolume ? '✅' : '❌'}`);
  console.log(`🚀 Easypanel: ${isEasypanel ? '✅' : '❌'}`);
  
  // Configurar variáveis de ambiente baseado na detecção
  if (hasDataVolume) {
    process.env.DATABASE_URL = 'file:/data/production.db';
    process.env.USE_DATA_VOLUME = 'true';
    console.log('📊 Configurado para usar volume persistente: /data');
  } else if (isDocker) {
    process.env.DATABASE_URL = 'file:./data/production.db';
    console.log('📊 Configurado para usar diretório local: ./data');
  } else {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    console.log('📊 Configurado para desenvolvimento: ./prisma/dev.db');
  }
  
  // Configurar outras variáveis baseadas no ambiente
  if (isEasypanel || isDocker) {
    // Configurações de produção
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    process.env.PORT = process.env.PORT || '3001';
  }
  
  console.log(`🌍 Ambiente detectado: ${process.env.NODE_ENV}`);
  console.log(`📊 Banco configurado: ${process.env.DATABASE_URL}`);
  
  return {
    isDocker,
    hasDataVolume,
    isEasypanel,
    databaseUrl: process.env.DATABASE_URL
  };
}

// Executar detecção automaticamente quando importado
const envInfo = detectEnvironment();

module.exports = {
  detectEnvironment,
  envInfo
};