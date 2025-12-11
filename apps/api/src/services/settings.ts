import { z } from 'zod';

import prisma from '../lib/prisma';

export const settingKeySchema = z.enum(['general', 'whatsapp', 'ai', 'backup']);
export type SettingKey = z.infer<typeof settingKeySchema>;

type BusinessHours = { start: string; end: string; timezone: string };

type GeneralSettings = {
  companyName: string;
  businessEmail: string;
  businessPhone: string;
  taxRate: number;
  currency: string;
  businessHours: BusinessHours;
  terms: string;
};

type WhatsappSettings = {
  businessNumber: string;
  sessionName: string;
  dailyLimit: number;
  randomDelayMin: number;
  randomDelayMax: number;
  respectBusinessHours: boolean;
  optOutKeywords: string[];
};

type AiSettings = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  autoReplyEnabled: boolean;
};

type BackupSettings = {
  manualEnabled: boolean;
  includeUploads: boolean;
  retentionDays: number;
  schedule: string;
  notifyEmail: string;
};

export type SettingMap = {
  general: GeneralSettings;
  whatsapp: WhatsappSettings;
  ai: AiSettings;
  backup: BackupSettings;
};

export const settingDefaults: SettingMap = {
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
    temperature: 0.3,
    maxTokens: 800,
    systemPrompt: '',
    autoReplyEnabled: true,
  },
  backup: {
    manualEnabled: true,
    includeUploads: true,
    retentionDays: 30,
    schedule: '02:00',
    notifyEmail: 'admin@example.com',
  },
};

const generalSchema = z.object({
  companyName: z.string().min(1),
  businessEmail: z.string().email(),
  businessPhone: z.string().min(3),
  taxRate: z.number().min(0).max(100),
  currency: z.string().min(1),
  businessHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string().min(2),
  }),
  terms: z.string().min(1),
});

const whatsappSchema = z
  .object({
    businessNumber: z.string().min(3),
    sessionName: z.string().min(1),
    dailyLimit: z.number().min(10).max(5000),
    randomDelayMin: z.number().min(0).max(300),
    randomDelayMax: z.number().min(0).max(600),
    respectBusinessHours: z.boolean(),
    optOutKeywords: z.array(z.string().min(1)).max(10),
  })
  .refine((data) => data.randomDelayMin <= data.randomDelayMax, {
    message: 'randomDelayMin must be <= randomDelayMax',
    path: ['randomDelayMin'],
  });

const aiSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional().transform((value) => value ?? ''),
  baseUrl: z.string().optional().transform((value) => value ?? ''),
  model: z.string().min(1),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().min(64).max(4000),
  systemPrompt: z.string().optional().transform((value) => value ?? ''),
  autoReplyEnabled: z.boolean().optional().default(true),
});

const backupSchema = z.object({
  manualEnabled: z.boolean(),
  includeUploads: z.boolean(),
  retentionDays: z.number().min(1).max(365),
  schedule: z.string().regex(/^\d{2}:\d{2}$/),
  notifyEmail: z.string().email(),
});

export const settingSchemas: Record<SettingKey, z.ZodTypeAny> = {
  general: generalSchema,
  whatsapp: whatsappSchema,
  ai: aiSchema,
  backup: backupSchema,
};

const cloneDefaults = (): SettingMap => JSON.parse(JSON.stringify(settingDefaults));

export async function getAllSettings(): Promise<SettingMap> {
  const rows = await prisma.systemSetting.findMany();
  const data = cloneDefaults();
  for (const row of rows) {
    const parsedKey = settingKeySchema.safeParse(row.key);
    if (parsedKey.success) {
      const key = parsedKey.data;
      const value = row.value as SettingMap[typeof key];
      switch (key) {
        case 'general':
          data.general = { ...data.general, ...value };
          break;
        case 'whatsapp':
          data.whatsapp = { ...data.whatsapp, ...value };
          break;
        case 'ai':
          data.ai = { ...data.ai, ...value };
          break;
        case 'backup':
          data.backup = { ...data.backup, ...value };
          break;
      }
    }
  }
  return data;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingMap[K]> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const merged = { ...settingDefaults[key], ...(row?.value as object | undefined) } as SettingMap[K];
  return merged;
}

export async function saveSetting<K extends SettingKey>(key: K, value: SettingMap[K], updatedById?: string) {
  const schema = settingSchemas[key];
  const parsed = schema.parse(value);
  const record = await prisma.systemSetting.upsert({
    where: { key },
    update: { value: parsed, updatedById: updatedById ?? null },
    create: { key, value: parsed, group: key, updatedById: updatedById ?? null },
  });
  return { key: record.key as SettingKey, value: record.value as SettingMap[K], updatedAt: record.updatedAt };
}
