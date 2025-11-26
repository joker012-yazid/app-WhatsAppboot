"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAiSettingsCache = void 0;
exports.generateAiResponse = generateAiResponse;
const prisma_1 = __importDefault(require("../lib/prisma"));
const env_1 = __importDefault(require("../config/env"));
const aiDefaults = {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 512,
};
let cached = null;
const resetAiSettingsCache = () => {
    cached = null;
};
exports.resetAiSettingsCache = resetAiSettingsCache;
const loadAiSettings = async () => {
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    const row = await prisma_1.default.systemSetting.findUnique({ where: { key: 'ai' } });
    const merged = { ...aiDefaults, ...row?.value };
    cached = { data: merged, expiresAt: Date.now() + 60 * 1000 };
    return merged;
};
async function generateAiResponse({ prompt, system, maxTokens }) {
    const settings = await loadAiSettings();
    const apiKey = settings.apiKey || env_1.default.OPENAI_API_KEY;
    const base = settings.baseUrl || env_1.default.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const finalMaxTokens = maxTokens ?? settings.maxTokens ?? aiDefaults.maxTokens;
    const temperature = settings.temperature ?? aiDefaults.temperature;
    if (!apiKey) {
        return `AI stub response: ${prompt.slice(0, 200)}`;
    }
    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: settings.model || aiDefaults.model,
                messages: [
                    ...(system ? [{ role: 'system', content: system }] : []),
                    { role: 'user', content: prompt },
                ],
                max_tokens: finalMaxTokens,
                temperature,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI error ${res.status}: ${text}`);
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        return String(content);
    }
    catch (e) {
        return `AI provider error: ${e?.message || 'unknown error'}`;
    }
}
