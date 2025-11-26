"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAiResponse = generateAiResponse;
const env_1 = __importDefault(require("../config/env"));
async function generateAiResponse({ prompt, system, maxTokens = 512 }) {
    if (!env_1.default.OPENAI_API_KEY) {
        return `AI stub response: ${prompt.slice(0, 200)}`;
    }
    const base = env_1.default.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env_1.default.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    ...(system ? [{ role: 'system', content: system }] : []),
                    { role: 'user', content: prompt },
                ],
                max_tokens: maxTokens,
                temperature: 0.2,
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
