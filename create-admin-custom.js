const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createCustomAdmin() {
  try {
    console.log('🔧 Criando usuário administrador...\n');
    
    const username = await askQuestion('Digite o username do admin: ');
    const password = await askQuestion('Digite a senha do admin: ');
    
    if (!username || !password) {
      console.log('❌ Username e senha são obrigatórios');
      return;
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingUser) {
      console.log('❌ Usuário já existe');
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    });
    
    console.log('\n✅ Usuário admin criado com sucesso:');
    console.log('Username:', admin.username);
    console.log('ID:', admin.id);
    console.log('Data de criação:', admin.createdAt);
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error.message);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

createCustomAdmin();