import bcrypt from 'bcryptjs';

import prisma from '../lib/prisma';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`[seed] Created admin user ${email} with default password`);
}

main().catch((e) => {
  console.error('[seed] failed', e);
  process.exit(1);
});

