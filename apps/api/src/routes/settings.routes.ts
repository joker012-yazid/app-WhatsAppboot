import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth';
import { resetAiSettingsCache } from '../services/ai';
import { restartBackupScheduler } from '../scheduler/backups';
import { getAllSettings, saveSetting, settingKeySchema, settingSchemas, SettingKey } from '../services/settings';

const router = Router();

router.get('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (_req, res) => {
  const settings = await getAllSettings();
  return res.json(settings);
});

router.put('/:key', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const keyResult = settingKeySchema.safeParse(req.params.key);
  if (!keyResult.success) {
    return res.status(400).json({ message: 'Unknown settings group' });
  }
  const key = keyResult.data as SettingKey;
  const schema = settingSchemas[key];
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.flatten() });
  }
  const record = await saveSetting(key, parsed.data, req.user?.sub);
  if (key === 'ai') resetAiSettingsCache();
  if (key === 'backup') await restartBackupScheduler();
  return res.json(record);
});

export default router;

