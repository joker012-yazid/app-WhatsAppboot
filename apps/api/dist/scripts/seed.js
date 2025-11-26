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
}
main().catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
});
