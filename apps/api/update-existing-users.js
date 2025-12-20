const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateExistingUsers() {
  try {
    // Update existing users to add username and set correct roles
    const users = await prisma.user.findMany();

    for (const user of users) {
      let username = '';
      let role = 'USER';
      let status = 'ACTIVE';

      if (user.email === 'admin@example.com') {
        username = 'admin';
        role = 'ADMIN';
        status = 'ACTIVE';
      } else if (user.email === 'tech@example.com') {
        username = 'ahmad';
        role = 'USER';
        status = 'ACTIVE';
      } else if (user.email === 'siti@example.com') {
        username = 'siti';
        role = 'USER';
        status = 'ACTIVE';
      } else if (user.email === 'manager@example.com') {
        username = 'sarah';
        role = 'USER';
        status = 'ACTIVE';
      } else {
        // Generate username from email
        username = user.email.split('@')[0];
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: username,
          role: role,
          status: status
        }
      });

      console.log(`✅ Updated ${user.email} -> username: ${username}, role: ${role}`);
    }

  } catch (error) {
    console.error('Error updating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingUsers();