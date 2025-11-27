import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth';
import { createBackup, getBackupFile, listBackups, restoreBackup } from '../services/backup';

const router = Router();

router.get('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (_req, res) => {
  const backups = await listBackups();
  return res.json(backups);
});

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (_req, res) => {
  const backup = await createBackup({ manual: true });
  return res.status(201).json(backup);
});

router.get('/:filename/download', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { path } = await getBackupFile(req.params.filename);
    return res.download(path, req.params.filename);
  } catch (error: any) {
    return res.status(404).json({ message: error?.message || 'Backup not found' });
  }
});

router.post('/:filename/restore', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const result = await restoreBackup(req.params.filename);
    return res.json({
      message:
        'Backup extracted. Import meta/database.sql via psql and copy uploads/storage folders manually if needed.',
      ...result,
    });
  } catch (error: any) {
    return res.status(404).json({ message: error?.message || 'Restore failed' });
  }
});

export default router;
