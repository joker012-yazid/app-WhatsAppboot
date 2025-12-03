"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const backup_1 = require("../services/backup");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (_req, res) => {
    const backups = await (0, backup_1.listBackups)();
    return res.json(backups);
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (_req, res) => {
    const backup = await (0, backup_1.createBackup)({ manual: true });
    return res.status(201).json(backup);
});
router.get('/:filename/download', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const { path } = await (0, backup_1.getBackupFile)(req.params.filename);
        return res.download(path, req.params.filename);
    }
    catch (error) {
        return res.status(404).json({ message: error?.message || 'Backup not found' });
    }
});
router.post('/:filename/restore', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const result = await (0, backup_1.restoreBackup)(req.params.filename);
        return res.json({
            message: 'Backup extracted. Import meta/database.sql via psql and copy uploads/storage folders manually if needed.',
            ...result,
        });
    }
    catch (error) {
        return res.status(404).json({ message: error?.message || 'Restore failed' });
    }
});
exports.default = router;
