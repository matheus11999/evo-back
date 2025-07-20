# WhatsApp Sender - Backend

Backend da plataforma WhatsApp Sender usando Evolution API v2.2.2.

## Funcionalidades

- 📱 Gerenciamento de instâncias WhatsApp
- 📧 Envio automático de mensagens
- 👥 Gerenciamento de grupos
- 📊 Campanhas automáticas
- 📈 Dashboard e relatórios
- 🔐 Sistema de autenticação
- 🗃️ Logs e auditoria

## Tecnologias

- Node.js + Express
- Prisma ORM + SQLite
- JWT Authentication
- Evolution API v2.2.2
- Cron Jobs para automação

## Instalação

```bash
# Instalar dependências
npm install

# Configurar banco de dados
npx prisma generate
npx prisma db push

# Criar usuário admin
node create-admin.js

# Iniciar em desenvolvimento
npm run dev

# Iniciar em produção
npm run start:prod
```

## Configuração

Copie `.env.example` para `.env` e configure:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=file:./prisma/production.db
EVOLUTION_API_URL=https://your-evolution-api.com
EVOLUTION_API_KEY=your-api-key
JWT_SECRET=your-secure-secret
```

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro

### Instâncias
- `GET /api/config/instances` - Listar instâncias
- `POST /api/config/instances` - Criar instância
- `DELETE /api/config/instances/:id` - Deletar instância

### Mensagens
- `POST /api/campaigns` - Criar campanha
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns/:id/send` - Enviar campanha

### Grupos
- `GET /api/groups` - Listar grupos
- `GET /api/groups/:instanceId` - Grupos por instância

## Deploy

### Docker
```bash
docker build -t whatsapp-sender-backend .
docker run -p 3001:3001 whatsapp-sender-backend
```

### PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

## Estrutura

```
src/
├── routes/          # Rotas da API
├── services/        # Serviços de negócio
├── middleware/      # Middlewares
└── utils/          # Utilitários
```

## Licença

MIT