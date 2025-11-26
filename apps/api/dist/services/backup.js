"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreBackup = exports.getBackupFile = exports.createBackup = exports.listBackups = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const adm_zip_1 = __importDefault(require("adm-zip"));
const env_1 = __importDefault(require("../config/env"));
const settings_1 = require("./settings");
const repoRoot = node_path_1.default.resolve(__dirname, '../../..');
const backupDir = node_path_1.default.resolve(repoRoot, 'backups');
const uploadsDir = node_path_1.default.resolve(repoRoot, 'uploads');
const storageDir = node_path_1.default.resolve(repoRoot, 'storage');
const sessionsDir = node_path_1.default.resolve(repoRoot, 'whatsapp-sessions');
const restoreDir = node_path_1.default.join(backupDir, 'restores');
const ensureDir = (dir) => promises_1.default.mkdir(dir, { recursive: true });
const formatTimestamp = (date = new Date()) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
].join('');
const pgDump = async (targetFile) => {
    const url = env_1.default.DATABASE_URL;
    await ensureDir(node_path_1.default.dirname(targetFile));
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)('pg_dump', ['--file', targetFile, '--format=plain', '--no-owner', '--dbname', url], {
            env: process.env,
        });
        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(stderr || `pg_dump exited with code ${code}`));
        });
    });
};
const safeStat = async (target) => {
    try {
        return await promises_1.default.stat(target);
    }
    catch (error) {
        return null;
    }
};
const withinDir = (dir, file) => {
    const resolved = node_path_1.default.resolve(dir, file);
    if (!resolved.startsWith(node_path_1.default.resolve(dir)))
        throw new Error('Invalid path');
    return resolved;
};
const listBackups = async () => {
    await ensureDir(backupDir);
    const entries = await promises_1.default.readdir(backupDir);
    const rows = [];
    for (const name of entries) {
        if (!name.endsWith('.zip'))
            continue;
        const full = node_path_1.default.join(backupDir, name);
        const stat = await safeStat(full);
        if (!stat || !stat.isFile())
            continue;
        rows.push({ filename: name, size: stat.size, createdAt: stat.birthtime.toISOString() });
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
exports.listBackups = listBackups;
const enforceRetention = async (retentionDays) => {
    if (!retentionDays)
        return;
    const rows = await (0, exports.listBackups)();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    for (const row of rows) {
        if (new Date(row.createdAt).getTime() < cutoff) {
            await promises_1.default.rm(node_path_1.default.join(backupDir, row.filename), { force: true });
        }
    }
};
const createBackup = async (opts) => {
    const settings = await (0, settings_1.getSetting)('backup');
    await ensureDir(backupDir);
    const timestamp = formatTimestamp();
    const metaDir = node_path_1.default.join(backupDir, `.tmp-${timestamp}`);
    await ensureDir(metaDir);
    const metadata = {
        createdAt: new Date().toISOString(),
        includeUploads: settings.includeUploads,
        retentionDays: settings.retentionDays,
        manual: Boolean(opts?.manual),
        schedule: settings.schedule,
    };
    await promises_1.default.writeFile(node_path_1.default.join(metaDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    try {
        await pgDump(node_path_1.default.join(metaDir, 'database.sql'));
    }
    catch (error) {
        await promises_1.default.writeFile(node_path_1.default.join(metaDir, 'database-error.txt'), `Failed to run pg_dump. Ensure PostgreSQL client tools are installed.\n${error?.message || error}`);
    }
    const zipName = `backup-${timestamp}.zip`;
    const zipPath = node_path_1.default.join(backupDir, zipName);
    const zip = new adm_zip_1.default();
    zip.addLocalFolder(metaDir, 'meta');
    const includeUploads = settings.includeUploads !== false;
    if (includeUploads && node_fs_1.default.existsSync(uploadsDir))
        zip.addLocalFolder(uploadsDir, 'uploads');
    if (includeUploads && node_fs_1.default.existsSync(storageDir))
        zip.addLocalFolder(storageDir, 'storage');
    if (node_fs_1.default.existsSync(sessionsDir))
        zip.addLocalFolder(sessionsDir, 'whatsapp-sessions');
    zip.writeZip(zipPath);
    await promises_1.default.rm(metaDir, { recursive: true, force: true });
    await enforceRetention(settings.retentionDays || 30);
    const stat = await promises_1.default.stat(zipPath);
    return { filename: zipName, size: stat.size, createdAt: stat.birthtime.toISOString() };
};
exports.createBackup = createBackup;
const getBackupFile = async (filename) => {
    const full = withinDir(backupDir, filename);
    const stat = await safeStat(full);
    if (!stat)
        throw new Error('Backup not found');
    return { path: full, stat };
};
exports.getBackupFile = getBackupFile;
const restoreBackup = async (filename) => {
    const { path: filePath } = await (0, exports.getBackupFile)(filename);
    await ensureDir(restoreDir);
    const target = node_path_1.default.join(restoreDir, `${node_path_1.default.parse(filename).name}-${formatTimestamp()}`);
    await ensureDir(target);
    const zip = new adm_zip_1.default(filePath);
    zip.extractAllTo(target, true);
    return { extractedTo: target };
};
exports.restoreBackup = restoreBackup;
