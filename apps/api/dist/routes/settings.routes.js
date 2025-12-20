"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const ai_1 = require("../services/ai");
const backups_1 = require("../scheduler/backups");
const settings_1 = require("../services/settings");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (_req, res) => {
    const settings = await (0, settings_1.getAllSettings)();
    return res.json(settings);
});
router.put('/:key', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const keyResult = settings_1.settingKeySchema.safeParse(req.params.key);
    if (!keyResult.success) {
        return res.status(400).json({ message: 'Unknown settings group' });
    }
    const key = keyResult.data;
    const schema = settings_1.settingSchemas[key];
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
    }
    const record = await (0, settings_1.saveSetting)(key, parsed.data, req.user?.sub);
    if (key === 'ai')
        (0, ai_1.resetAiSettingsCache)();
    if (key === 'backup')
        await (0, backups_1.restartBackupScheduler)();
    return res.json(record);
});
exports.default = router;
