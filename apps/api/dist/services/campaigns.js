"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCampaignKinds = exports.listCampaignStatuses = exports.isCampaignSendable = exports.isCampaignActive = exports.randomDelayFromPayload = exports.businessHoursFromPayload = exports.persistCampaignFilters = exports.renderCampaignMessage = exports.extractTemplateVariables = exports.buildRecipientsForCampaign = exports.previewRecipients = exports.buildCustomerWhere = exports.normalizeFilters = exports.normalizePhone = exports.DEFAULT_BUSINESS_HOURS = exports.DO_NOT_CONTACT_TAGS = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.DO_NOT_CONTACT_TAGS = ['OPT_OUT', 'DO_NOT_CONTACT', 'STOP', 'UNSUBSCRIBE'];
exports.DEFAULT_BUSINESS_HOURS = { start: 9 * 60, end: 18 * 60 };
const DAY_MS = 24 * 60 * 60 * 1000;
const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;
const normalizePhone = (phone) => {
    const compact = phone.replace(/[^0-9+]/g, '');
    if (!compact)
        return '';
    if (compact.startsWith('+')) {
        return `+${compact.slice(1).replace(/\+/g, '')}`;
    }
    return compact.replace(/\+/g, '');
};
exports.normalizePhone = normalizePhone;
const uniq = (values = []) => Array.from(new Set(values));
const normalizeFilters = (raw) => {
    if (!raw)
        return {};
    return {
        customerTypes: raw.customerTypes && raw.customerTypes.length ? uniq(raw.customerTypes) : undefined,
        tags: raw.tags?.map((t) => t.trim()).filter(Boolean),
        excludeTags: raw.excludeTags?.map((t) => t.trim()).filter(Boolean),
        lastVisitDays: raw.lastVisitDays && raw.lastVisitDays > 0 ? raw.lastVisitDays : undefined,
        inactiveDays: raw.inactiveDays && raw.inactiveDays > 0 ? raw.inactiveDays : undefined,
        search: raw.search?.trim() || undefined,
        manualPhones: raw.manualPhones?.map((phone) => (0, exports.normalizePhone)(phone)).filter((phone) => phone.length > 3) ?? undefined,
    };
};
exports.normalizeFilters = normalizeFilters;
const buildCustomerWhere = (filters) => {
    const where = {};
    const and = [];
    if (filters.customerTypes?.length)
        where.type = { in: filters.customerTypes };
    if (filters.tags?.length)
        where.tags = { hasSome: filters.tags };
    if (filters.excludeTags?.length)
        and.push({ NOT: { tags: { hasSome: filters.excludeTags } } });
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
    if (and.length)
        where.AND = and;
    return where;
};
exports.buildCustomerWhere = buildCustomerWhere;
const mapCustomersToTargets = (customers) => {
    const seen = new Set();
    return customers
        .map((customer) => {
        const phone = (0, exports.normalizePhone)(customer.phone);
        if (!phone || seen.has(phone))
            return null;
        seen.add(phone);
        return {
            customerId: customer.id,
            name: customer.name,
            phone,
            tags: customer.tags || [],
            type: customer.type,
            lastVisitAt: customer.jobs[0]?.updatedAt ?? null,
        };
    })
        .filter(Boolean);
};
const previewRecipients = async (filters, limit = 50) => {
    const normalized = (0, exports.normalizeFilters)(filters);
    const where = (0, exports.buildCustomerWhere)(normalized);
    const [customers, total] = await Promise.all([
        prisma_1.default.customer.findMany({
            where,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { jobs: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
        }),
        prisma_1.default.customer.count({ where }),
    ]);
    const targets = mapCustomersToTargets(customers);
    const manualTargets = [];
    const existing = new Set(targets.map((t) => t.phone));
    for (const phone of normalized.manualPhones || []) {
        if (existing.has(phone))
            continue;
        existing.add(phone);
        manualTargets.push({
            customerId: null,
            name: 'Manual recipient',
            phone,
            tags: [],
            type: client_1.CustomerType.PROSPECT,
            lastVisitAt: null,
        });
    }
    return { targets, manualTargets, total, manualCount: normalized.manualPhones?.length ?? 0 };
};
exports.previewRecipients = previewRecipients;
const buildRecipientsForCampaign = async (campaignId, filters) => {
    const normalized = (0, exports.normalizeFilters)(filters);
    const where = (0, exports.buildCustomerWhere)(normalized);
    const customers = await prisma_1.default.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { jobs: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
    });
    const targets = mapCustomersToTargets(customers);
    const seen = new Set(targets.map((t) => t.phone));
    const manualTargets = [];
    for (const phone of normalized.manualPhones || []) {
        if (seen.has(phone))
            continue;
        seen.add(phone);
        manualTargets.push({
            customerId: null,
            name: 'Manual recipient',
            phone,
            tags: [],
            type: client_1.CustomerType.PROSPECT,
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
exports.buildRecipientsForCampaign = buildRecipientsForCampaign;
const extractTemplateVariables = (message) => {
    const vars = new Set();
    let match;
    while ((match = placeholderRegex.exec(message))) {
        vars.add(match[1]);
    }
    return Array.from(vars);
};
exports.extractTemplateVariables = extractTemplateVariables;
const renderCampaignMessage = (template, recipient, extras = {}) => {
    return template.replace(placeholderRegex, (_, key) => {
        const lower = String(key).toLowerCase();
        if (lower === 'name')
            return recipient.name || 'customer';
        if (lower === 'phone')
            return recipient.phone;
        return extras[key] ?? `{${key}}`;
    });
};
exports.renderCampaignMessage = renderCampaignMessage;
const persistCampaignFilters = (filters) => {
    if (!filters)
        return undefined;
    const normalized = (0, exports.normalizeFilters)(filters);
    return normalized;
};
exports.persistCampaignFilters = persistCampaignFilters;
const businessHoursFromPayload = (payload) => {
    const start = typeof payload?.start === 'number' ? payload.start : exports.DEFAULT_BUSINESS_HOURS.start;
    const end = typeof payload?.end === 'number' ? payload.end : exports.DEFAULT_BUSINESS_HOURS.end;
    return { start, end };
};
exports.businessHoursFromPayload = businessHoursFromPayload;
const randomDelayFromPayload = (payload) => {
    const min = Math.max(1, Math.min(600, payload?.min ?? 30));
    const max = Math.max(min, Math.min(900, payload?.max ?? 60));
    return { min, max };
};
exports.randomDelayFromPayload = randomDelayFromPayload;
const isCampaignActive = (status) => status === client_1.CampaignStatus.RUNNING || status === client_1.CampaignStatus.SCHEDULED || status === client_1.CampaignStatus.PAUSED;
exports.isCampaignActive = isCampaignActive;
const isCampaignSendable = (status) => status === client_1.CampaignStatus.DRAFT || status === client_1.CampaignStatus.SCHEDULED || status === client_1.CampaignStatus.PAUSED;
exports.isCampaignSendable = isCampaignSendable;
const listCampaignStatuses = () => Object.values(client_1.CampaignStatus);
exports.listCampaignStatuses = listCampaignStatuses;
const listCampaignKinds = () => Object.values(client_1.CampaignKind);
exports.listCampaignKinds = listCampaignKinds;
