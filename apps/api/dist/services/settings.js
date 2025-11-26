"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingSchemas = exports.settingDefaults = exports.settingKeySchema = void 0;
exports.getAllSettings = getAllSettings;
exports.getSetting = getSetting;
exports.saveSetting = saveSetting;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.settingKeySchema = zod_1.z.enum(['general', 'whatsapp', 'ai', 'backup']);
exports.settingDefaults = {
    general: {
        companyName: 'RepairCo',
        businessEmail: 'admin@example.com',
        businessPhone: '+60 11-0000 0000',
        taxRate: 6,
        currency: 'MYR',
        businessHours: { start: '09:00', end: '18:00', timezone: 'Asia/Kuala_Lumpur' },
        terms: 'Devices left over 60 days may be recycled.',
    },
    whatsapp: {
        businessNumber: '+60 11-0000 0000',
        sessionName: 'primary',
        dailyLimit: 150,
        randomDelayMin: 30,
        randomDelayMax: 60,
        respectBusinessHours: true,
        optOutKeywords: ['STOP', 'UNSUBSCRIBE'],
    },
    ai: {
        provider: 'openai',
        apiKey: '',
        baseUrl: '',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 512,
    },
    backup: {
        manualEnabled: true,
        includeUploads: true,
        retentionDays: 30,
        schedule: '02:00',
        notifyEmail: 'admin@example.com',
    },
};
const generalSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(1),
    businessEmail: zod_1.z.string().email(),
    businessPhone: zod_1.z.string().min(3),
    taxRate: zod_1.z.number().min(0).max(100),
    currency: zod_1.z.string().min(1),
    businessHours: zod_1.z.object({
        start: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
        end: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
        timezone: zod_1.z.string().min(2),
    }),
    terms: zod_1.z.string().min(1),
});
const whatsappSchema = zod_1.z
    .object({
    businessNumber: zod_1.z.string().min(3),
    sessionName: zod_1.z.string().min(1),
    dailyLimit: zod_1.z.number().min(10).max(5000),
    randomDelayMin: zod_1.z.number().min(0).max(300),
    randomDelayMax: zod_1.z.number().min(0).max(600),
    respectBusinessHours: zod_1.z.boolean(),
    optOutKeywords: zod_1.z.array(zod_1.z.string().min(1)).max(10),
})
    .refine((data) => data.randomDelayMin <= data.randomDelayMax, {
    message: 'randomDelayMin must be <= randomDelayMax',
    path: ['randomDelayMin'],
});
const aiSchema = zod_1.z.object({
    provider: zod_1.z.string().min(1),
    apiKey: zod_1.z.string().optional().transform((value) => value ?? ''),
    baseUrl: zod_1.z.string().optional().transform((value) => value ?? ''),
    model: zod_1.z.string().min(1),
    temperature: zod_1.z.number().min(0).max(1),
    maxTokens: zod_1.z.number().min(64).max(4000),
});
const backupSchema = zod_1.z.object({
    manualEnabled: zod_1.z.boolean(),
    includeUploads: zod_1.z.boolean(),
    retentionDays: zod_1.z.number().min(1).max(365),
    schedule: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    notifyEmail: zod_1.z.string().email(),
});
exports.settingSchemas = {
    general: generalSchema,
    whatsapp: whatsappSchema,
    ai: aiSchema,
    backup: backupSchema,
};
const cloneDefaults = () => JSON.parse(JSON.stringify(exports.settingDefaults));
async function getAllSettings() {
    const rows = await prisma_1.default.systemSetting.findMany();
    const data = cloneDefaults();
    for (const row of rows) {
        if (exports.settingKeySchema.safeParse(row.key).success) {
            const key = row.key;
            data[key] = { ...data[key], ...row.value };
        }
    }
    return data;
}
async function getSetting(key) {
    const row = await prisma_1.default.systemSetting.findUnique({ where: { key } });
    const merged = { ...exports.settingDefaults[key], ...row?.value };
    return merged;
}
async function saveSetting(key, value, updatedById) {
    const schema = exports.settingSchemas[key];
    const parsed = schema.parse(value);
    const record = await prisma_1.default.systemSetting.upsert({
        where: { key },
        update: { value: parsed, updatedById: updatedById ?? null },
        create: { key, value: parsed, group: key, updatedById: updatedById ?? null },
    });
    return { key: record.key, value: record.value, updatedAt: record.updatedAt };
}
