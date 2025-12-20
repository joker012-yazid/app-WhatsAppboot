const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    // Create Admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        name: 'Admin User',
        passwordHash: adminPassword,
        role: 'ADMIN'
      }
    });
    console.log('✅ Admin created:', admin.email);

    // Create Technician user
    const techPassword = await bcrypt.hash('tech123', 10);
    const technician = await prisma.user.upsert({
      where: { email: 'tech@example.com' },
      update: {},
      create: {
        email: 'tech@example.com',
        name: 'Ahmad Technician',
        passwordHash: techPassword,
        role: 'TECHNICIAN'
      }
    });
    console.log('✅ Technician created:', technician.email);

    // Create Manager user
    const managerPassword = await bcrypt.hash('manager123', 10);
    const manager = await prisma.user.upsert({
      where: { email: 'manager@example.com' },
      update: {},
      create: {
        email: 'manager@example.com',
        name: 'Sarah Manager',
        passwordHash: managerPassword,
        role: 'MANAGER'
      }
    });
    console.log('✅ Manager created:', manager.email);

    // Create second Technician user
    const tech2Password = await bcrypt.hash('tech456', 10);
    const technician2 = await prisma.user.upsert({
      where: { email: 'siti@example.com' },
      update: {},
      create: {
        email: 'siti@example.com',
        name: 'Siti Technician',
        passwordHash: tech2Password,
        role: 'TECHNICIAN'
      }
    });
    console.log('✅ Second Technician created:', technician2.email);

  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();