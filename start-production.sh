#!/bin/bash

echo "🚀 Iniciando WhatsApp Sender em modo produção..."

# Verificar variáveis de ambiente obrigatórias
if [ -z "$EVOLUTION_API_URL" ]; then
    echo "❌ EVOLUTION_API_URL não definida"
    exit 1
fi

if [ -z "$EVOLUTION_API_KEY" ]; then
    echo "❌ EVOLUTION_API_KEY não definida"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET não definida"
    exit 1
fi

# Definir NODE_ENV se não estiver definido
export NODE_ENV=${NODE_ENV:-production}

# Aplicar migrações do banco
echo "📊 Aplicando migrações do banco de dados..."
npx prisma db push

# Gerar cliente Prisma
echo "🔧 Gerando cliente Prisma..."
npx prisma generate

# Verificar se existe usuário admin
echo "👤 Verificando usuário admin..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  const admin = await prisma.user.findFirst();
  if (!admin) {
    console.log('⚠️ Nenhum usuário encontrado. Execute o script create-admin.js após a inicialização.');
  } else {
    console.log('✅ Usuário admin encontrado');
  }
  await prisma.\$disconnect();
}

checkAdmin().catch(console.error);
"

# Criar diretórios necessários
mkdir -p uploads logs

echo "✅ Configuração concluída. Iniciando servidor..."

# Iniciar servidor
exec node src/server.js