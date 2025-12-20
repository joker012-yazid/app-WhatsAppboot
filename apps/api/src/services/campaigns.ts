import { CampaignKind, CampaignStatus, CustomerType, Prisma } from '@prisma/client';

import prisma from '../lib/prisma';

export const DO_NOT_CONTACT_TAGS = ['OPT_OUT', 'DO_NOT_CONTACT', 'STOP', 'UNSUBSCRIBE'];
export const DEFAULT_BUSINESS_HOURS = { start: 9 * 60, end: 18 * 60 };

const DAY_MS = 24 * 60 * 60 * 1000;

export type CampaignFilters = {
  customerTypes?: CustomerType[];
  tags?: string[];
  excludeTags?: string[];
  lastVisitDays?: number;
  inactiveDays?: number;
  search?: string;
  manualPhones?: string[];
};

export type CampaignTarget = {
  customerId: string | null;
  name: string;
  phone: string;
  tags: string[];
  type: CustomerType;
  lastVisitAt: Date | null;
};

const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;

export const normalizePhone = (phone: string) => {
  const compact = phone.replace(/[^0-9+]/g, '');
  if (!compact) return '';
  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\+/g, '')}`;
  }
  return compact.replace(/\+/g, '');
};

const uniq = <T>(values: T[] = []) => Array.from(new Set(values));

export const normalizeFilters = (raw?: CampaignFilters | null): CampaignFilters => {
  if (!raw) return {};
  return {
    customerTypes: raw.customerTypes && raw.customerTypes.length ? uniq(raw.customerTypes) : undefined,
    tags: raw.tags?.map((t) => t.trim()).filter(Boolean),
    excludeTags: raw.excludeTags?.map((t) => t.trim()).filter(Boolean),
    lastVisitDays: raw.lastVisitDays && raw.lastVisitDays > 0 ? raw.lastVisitDays : undefined,
    inactiveDays: raw.inactiveDays && raw.inactiveDays > 0 ? raw.inactiveDays : undefined,
    search: raw.search?.trim() || undefined,
    manualPhones:
      raw.manualPhones?.map((phone) => normalizePhone(phone)).filter((phone) => phone.length > 3) ?? undefined,
  };
};

type CustomerWithLatestJob = Prisma.CustomerGetPayload<{ include: { jobs: { select: { updatedAt: true } } } }>

export const buildCustomerWhere = (filters: CampaignFilters): Prisma.CustomerWhereInput => {
  const where: Prisma.CustomerWhereInput = {};
  const and: Prisma.CustomerWhereInput[] = [];
  if (filters.customerTypes?.length) where.type = { in: filters.customerTypes };
  if (filters.tags?.length) where.tags = { hasSome: filters.tags };
  if (filters.excludeTags?.length) and.push({ NOT: { tags: { hasSome: filters.excludeTags } } });
  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.lastVisitDays) {
    const since = new Date(Date.now() - filters.lastVisitDays * DAY_MS);
    and.push({ jobs: { some: { updatedAt: { gte: since } } } });
  }
  if (filters.inactiveDays) {
    const cutoff = new Date(Date.now() - filters.inactiveDays * DAY_MS);
    and.push({ jobs: { none: { updatedAt: { gte: cutoff } } } });
  }
  if (and.length) where.AND = and;
  return where;
};

const mapCustomersToTargets = (customers: CustomerWithLatestJob[]): CampaignTarget[] => {
  const seen = new Set<string>();
  return customers
    .map((customer) => {
      const phone = normalizePhone(customer.phone);
      if (!phone || seen.has(phone)) return null;
      seen.add(phone);
      return {
        customerId: customer.id,
        name: customer.name,
        phone,
        tags: customer.tags || [],
        type: customer.type,
        lastVisitAt: customer.jobs[0]?.updatedAt ?? null,
      } satisfies CampaignTarget;
    })
    .filter(Boolean) as CampaignTarget[];
};

export const previewRecipients = async (filters: CampaignFilters, limit = 50) => {
  const normalized = normalizeFilters(filters);
  const where = buildCustomerWhere(normalized);
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { jobs: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
    }),
    prisma.customer.count({ where }),
  ]);
  const targets = mapCustomersToTargets(customers);
  const manualTargets: CampaignTarget[] = [];
  const existing = new Set(targets.map((t) => t.phone));
  for (const phone of normalized.manualPhones || []) {
    if (existing.has(phone)) continue;
    existing.add(phone);
    manualTargets.push({
      customerId: null,
      name: 'Manual recipient',
      phone,
      tags: [],
      type: CustomerType.PROSPECT,
      lastVisitAt: null,
    });
  }
  return { targets, manualTargets, total, manualCount: normalized.manualPhones?.length ?? 0 };
};

export const buildRecipientsForCampaign = async (campaignId: string, filters: CampaignFilters) => {
  const normalized = normalizeFilters(filters);
  const where = buildCustomerWhere(normalized);
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { jobs: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
  });
  const targets = mapCustomersToTargets(customers);
  const seen = new Set(targets.map((t) => t.phone));
  const manualTargets: CampaignTarget[] = [];
  for (const phone of normalized.manualPhones || []) {
    if (seen.has(phone)) continue;
    seen.add(phone);
    manualTargets.push({
      customerId: null,
      name: 'Manual recipient',
      phone,
      tags: [],
      type: CustomerType.PROSPECT,
      lastVisitAt: null,
    });
  }
  const rows = [...targets, ...manualTargets].map((target) => ({
    campaignId,
    customerId: target.customerId,
    phone: target.phone,
    name: target.name,
  }));
  return { rows, total: rows.length, customers: targets.length, manual: manualTargets.length };
};

export const extractTemplateVariables = (message: string): string[] => {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = placeholderRegex.exec(message))) {
    vars.add(match[1]);
  }
  return Array.from(vars);
};

export const renderCampaignMessage = (
  template: string,
  recipient: { name?: string | null; phone: string },
  extras: Record<string, string> = {},
) => {
  return template.replace(placeholderRegex, (_, key) => {
    const lower = String(key).toLowerCase();
    if (lower === 'name') return recipient.name || 'customer';
    if (lower === 'phone') return recipient.phone;
    return extras[key] ?? `{${key}}`;
  });
};

export const persistCampaignFilters = (filters: CampaignFilters | undefined | null): Prisma.JsonObject | undefined => {
  if (!filters) return undefined;
  const normalized = normalizeFilters(filters);
  return normalized as unknown as Prisma.JsonObject;
};

export const businessHoursFromPayload = (payload?: { start?: number; end?: number }) => {
  const start = typeof payload?.start === 'number' ? payload.start : DEFAULT_BUSINESS_HOURS.start;
  const end = typeof payload?.end === 'number' ? payload.end : DEFAULT_BUSINESS_HOURS.end;
  return { start, end };
};

export const randomDelayFromPayload = (payload?: { min?: number; max?: number }) => {
  const min = Math.max(1, Math.min(600, payload?.min ?? 30));
  const max = Math.max(min, Math.min(900, payload?.max ?? 60));
  return { min, max };
};

export const isCampaignActive = (status: CampaignStatus) =>
  status === CampaignStatus.RUNNING || status === CampaignStatus.SCHEDULED || status === CampaignStatus.PAUSED;

export const isCampaignSendable = (status: CampaignStatus) =>
  status === CampaignStatus.DRAFT || status === CampaignStatus.SCHEDULED || status === CampaignStatus.PAUSED;

export const listCampaignStatuses = () => Object.values(CampaignStatus);
export const listCampaignKinds = () => Object.values(CampaignKind);

