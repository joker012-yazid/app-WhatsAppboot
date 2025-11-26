import prisma from '../lib/prisma';
import env from '../config/env';

type GenerateParams = {
  prompt: string;
  system?: string;
  maxTokens?: number;
};

const aiDefaults = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 512,
};

type AiSettings = typeof aiDefaults;

let cached: { data: AiSettings; expiresAt: number } | null = null;

export const resetAiSettingsCache = () => {
  cached = null;
};

const loadAiSettings = async (): Promise<AiSettings> => {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const row = await prisma.systemSetting.findUnique({ where: { key: 'ai' } });
  const merged: AiSettings = { ...aiDefaults, ...(row?.value as Partial<AiSettings> | undefined) };
  cached = { data: merged, expiresAt: Date.now() + 60 * 1000 };
  return merged;
};

export async function generateAiResponse({ prompt, system, maxTokens }: GenerateParams): Promise<string> {
  const settings = await loadAiSettings();
  const apiKey = settings.apiKey || env.OPENAI_API_KEY;
  const base = settings.baseUrl || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
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
    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return String(content);
  } catch (e: any) {
    return `AI provider error: ${e?.message || 'unknown error'}`;
  }
}

