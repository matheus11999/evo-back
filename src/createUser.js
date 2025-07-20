const bcrypt = require('bcryptjs');
const prisma = require('./utils/prisma');

async function createDefaultUser() {
  try {
    // Verificar se já existe um usuário
    const existingUser = await prisma.user.findFirst();
    
    if (existingUser) {
      console.log('Usuário já existe:', existingUser.username);
      return;
    }

    // Criar usuário padrão
    const username = 'admin';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    });

    console.log('✅ Usuário padrão criado com sucesso!');
    console.log('📋 Credenciais:');
    console.log('   Usuário:', username);
    console.log('   Senha:', password);
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultUser();