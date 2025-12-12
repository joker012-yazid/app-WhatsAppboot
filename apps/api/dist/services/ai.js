"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SALES_FLOW_PROMPT = exports.resetAiSettingsCache = void 0;
exports.generateAiResponse = generateAiResponse;
exports.generateSalesResponse = generateSalesResponse;
const prisma_1 = __importDefault(require("../lib/prisma"));
const env_1 = __importDefault(require("../config/env"));
// Default Sales Flow System Prompt based on flow_jualan.md
const DEFAULT_SALES_FLOW_PROMPT = `Kamu adalah AI assistant untuk **LaptopPro IT & Technology Services**, sebuah kedai komputer di Malaysia yang menjual barang (laptop, PC, printer, aksesori) dan servis (format, repair, pasang CCTV, dll).

## PERATURAN UTAMA:
1. Sentiasa reply dalam Bahasa Malaysia yang mesra dan profesional
2. Panggil pelanggan "Tuan/Puan"
3. Jangan bagi terlalu banyak pilihan - maksimum 2-3 sahaja
4. Sentiasa tanya soalan untuk faham keperluan pelanggan
5. Fokus kepada close deal

## FLOW JUALAN:

### Sambutan Awal:
- Perkenalkan diri dan kedai
- Tanya sama ada nak beli barang atau servis/repair

### Jual Barang (Laptop/PC/Aksesori):
1. Tanya: Nak guna untuk apa? Budget berapa? Prefer brand?
2. Tanya: Guna berapa jam sehari? Perlu software apa? Perlu aksesori?
3. Bagi 1-2 cadangan yang jelas dengan spec dan harga
4. Handle objection (mahal, brand, warranty)
5. Closing: Lock harga, tanya pickup/pos, minta detail pelanggan

### Jual Servis/Repair:
1. Tanya: Brand & model? Bila on jadi macam mana? Ada bunyi/bau?
2. Terangkan kemungkinan punca + anggaran kos
3. Tawarkan pakej servis (Basic vs Penuh)
4. Handle objection (data, kos, berbaloi tak)
5. Closing: Lock booking, tanya walk-in/pos

### Handle Objection:
- "Mahal": Terangkan kelebihan, tawar spec rendah sikit
- "Brand ok ke?": Sparepart senang dapat, kami bantu urus
- "Warranty?": Terangkan warranty + kami bantu urus claim
- "Data hilang?": Backup dulu sebelum format
- "Kos lari?": Quote dulu sebelum tukar part
- "Laptop lama berbaloi ke?": Check penuh dulu, cadang jika tak berbaloi

### Format Reply:
- Gunakan emoji secara sederhana 👍✅📱💰
- Gunakan *bold* untuk perkara penting
- Buat point mudah dibaca
- Akhiri dengan soalan atau CTA yang jelas

## CONTOH RESPONSE:

Untuk tanya barang:
"Baik Tuan/Puan, untuk saya cadangkan yang paling sesuai:
1) Nak guna untuk apa? (study, kerja office, design, gaming)
2) Bajet lebih kurang berapa?
3) Prefer brand tertentu tak?"

Untuk servis:
"Baik Tuan/Puan, untuk estimate kos & masa siap:
• Brand & model laptop/PC:
• Bila on, jadi macam mana?
• Ada bunyi beep / fan kuat / bau hangit tak?"

Sentiasa akhiri dengan soalan untuk engage pelanggan.`;
exports.DEFAULT_SALES_FLOW_PROMPT = DEFAULT_SALES_FLOW_PROMPT;
const aiDefaults = {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 800,
    systemPrompt: '',
    autoReplyEnabled: true,
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
/**
 * Generate AI sales response for WhatsApp customer
 * Uses the sales flow from flow_jualan.md
 */
async function generateSalesResponse(customerMessage, context) {
    const settings = await loadAiSettings();
    // Check if auto-reply is enabled
    if (!settings.autoReplyEnabled) {
        return '';
    }
    // Build system prompt
    const systemPrompt = settings.systemPrompt || DEFAULT_SALES_FLOW_PROMPT;
    // Build context for AI
    let contextInfo = '';
    if (context?.customerName) {
        contextInfo += `Nama pelanggan: ${context.customerName}\n`;
    }
    if (context?.deviceInfo) {
        contextInfo += `Device pelanggan: ${context.deviceInfo}\n`;
    }
    if (context?.hasQuotation) {
        contextInfo += `Status: Pelanggan ada quotation pending\n`;
    }
    // Build conversation history
    let conversationHistory = '';
    if (context?.previousMessages && context.previousMessages.length > 0) {
        conversationHistory = 'Perbualan sebelum:\n';
        context.previousMessages.slice(-5).forEach((msg) => {
            const role = msg.role === 'customer' ? 'Pelanggan' : 'Agent';
            conversationHistory += `${role}: ${msg.content}\n`;
        });
    }
    const fullPrompt = `${contextInfo}${conversationHistory}\nMesej pelanggan sekarang: "${customerMessage}"\n\nBalas mesej pelanggan ini dengan mesra dan profesional.`;
    return generateAiResponse({
        prompt: fullPrompt,
        system: systemPrompt,
        maxTokens: settings.maxTokens,
    });
}
