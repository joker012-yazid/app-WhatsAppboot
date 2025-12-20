const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdminAccount() {
  try {
    // Update admin account to be active and add username
    const admin = await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: {
        username: 'admin',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Admin updated:', admin);

    // Update tech users
    await prisma.user.updateMany({
      where: {
        email: { in: ['tech@example.com', 'siti@example.com', 'manager@example.com'] }
      },
      data: {
        role: 'USER',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Other users updated to USER role with ACTIVE status');

  } catch (error) {
    console.error('Error updating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminAccount();