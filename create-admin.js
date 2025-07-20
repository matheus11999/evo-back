const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const username = 'admin';
    const password = '123456';
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    });
    
    console.log('Admin user created successfully:');
    console.log('Username:', admin.username);
    console.log('Password: 123456');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();