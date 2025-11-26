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

  // seed a few customers if none
  const count = await prisma.customer.count();
  if (count === 0) {
    const customers = [
      { name: 'Ali Ahmad', phone: '60110000001', email: 'ali@example.com', notes: 'VIP' },
      { name: 'Siti Nor', phone: '60110000002', email: 'siti@example.com', notes: null },
      { name: 'Rahman Co', phone: '60110000003', email: 'ops@rahmanco.my', notes: 'Corporate' },
      { name: 'Farah Aziz', phone: '60110000004', email: null, notes: 'Prefers WhatsApp' },
      { name: 'Daniel Tan', phone: '60110000005', email: 'daniel@example.com', notes: null },
    ];
    for (const c of customers) {
      await prisma.customer.create({ data: c });
    }
    console.log('[seed] Inserted 5 sample customers');
  }

  // seed a few devices for first two customers
  const some = await prisma.device.count();
  if (some === 0) {
    const firstTwo = await prisma.customer.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
    for (const c of firstTwo) {
      await prisma.device.create({
        data: {
          customerId: c.id,
          deviceType: 'Phone',
          brand: 'Generic',
          model: 'Model X',
          serialNumber: null,
        },
      });
    }
    console.log('[seed] Inserted sample devices');
  }
}

main().catch((e) => {
  console.error('[seed] failed', e);
  process.exit(1);
});
