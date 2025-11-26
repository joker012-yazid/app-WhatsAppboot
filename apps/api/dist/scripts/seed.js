"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
async function main() {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const name = process.env.ADMIN_NAME || 'Admin';
    const existing = await prisma_1.default.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`[seed] Admin already exists: ${email}`);
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    await prisma_1.default.user.create({
        data: {
            email,
            name,
            passwordHash,
            role: 'ADMIN',
        },
    });
    console.log(`[seed] Created admin user ${email} with default password`);
    // seed a few customers if none
    const count = await prisma_1.default.customer.count();
    if (count === 0) {
        const customers = [
            { name: 'Ali Ahmad', phone: '60110000001', email: 'ali@example.com', notes: 'VIP' },
            { name: 'Siti Nor', phone: '60110000002', email: 'siti@example.com', notes: null },
            { name: 'Rahman Co', phone: '60110000003', email: 'ops@rahmanco.my', notes: 'Corporate' },
            { name: 'Farah Aziz', phone: '60110000004', email: null, notes: 'Prefers WhatsApp' },
            { name: 'Daniel Tan', phone: '60110000005', email: 'daniel@example.com', notes: null },
        ];
        for (const c of customers) {
            await prisma_1.default.customer.create({ data: c });
        }
        console.log('[seed] Inserted 5 sample customers');
    }
    // seed a few devices for first two customers
    const some = await prisma_1.default.device.count();
    if (some === 0) {
        const firstTwo = await prisma_1.default.customer.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
        for (const c of firstTwo) {
            await prisma_1.default.device.create({
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
