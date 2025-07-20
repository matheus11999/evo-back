const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function createAdminUser() {
  try {
    const username = 'admin';
    const password = '123456';
    
    // Verificar se admin já existe
    const existingAdmin = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingAdmin) {
      console.log('👤 Usuário admin já existe');
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    });
    
    console.log('✅ Usuário admin criado com sucesso!');
    console.log('👤 Username: admin');
    console.log('🔑 Password: 123456');
    
    return admin;
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error.message);
    // Não lançar erro para não impedir o startup do servidor
  }
}

module.exports = { createAdminUser };