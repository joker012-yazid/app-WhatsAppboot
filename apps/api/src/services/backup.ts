import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import AdmZip from 'adm-zip';

import env from '../config/env';
import { getSetting } from './settings';

const repoRoot = path.resolve(__dirname, '../../..');
const backupDir = path.resolve(repoRoot, 'backups');
const uploadsDir = path.resolve(repoRoot, 'uploads');
const storageDir = path.resolve(repoRoot, 'storage');
const sessionsDir = path.resolve(repoRoot, 'whatsapp-sessions');
const restoreDir = path.join(backupDir, 'restores');

const ensureDir = (dir: string) => fsp.mkdir(dir, { recursive: true });
const formatTimestamp = (date = new Date()) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');

const pgDump = async (targetFile: string) => {
  const url = env.DATABASE_URL;
  await ensureDir(path.dirname(targetFile));
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_dump', ['--file', targetFile, '--format=plain', '--no-owner', '--dbname', url], {
      env: process.env,
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `pg_dump exited with code ${code}`));
    });
  });
};

const safeStat = async (target: string) => {
  try {
    return await fsp.stat(target);
  } catch (error) {
    return null;
  }
};

const withinDir = (dir: string, file: string) => {
  const resolved = path.resolve(dir, file);
  if (!resolved.startsWith(path.resolve(dir))) throw new Error('Invalid path');
  return resolved;
};

export type BackupSummary = {
  filename: string;
  size: number;
  createdAt: string;
};

export const listBackups = async (): Promise<BackupSummary[]> => {
  await ensureDir(backupDir);
  const entries = await fsp.readdir(backupDir);
  const rows: BackupSummary[] = [];
  for (const name of entries) {
    if (!name.endsWith('.zip')) continue;
    const full = path.join(backupDir, name);
    const stat = await safeStat(full);
    if (!stat || !stat.isFile()) continue;
    rows.push({ filename: name, size: stat.size, createdAt: stat.birthtime.toISOString() });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const enforceRetention = async (retentionDays: number) => {
  if (!retentionDays) return;
  const rows = await listBackups();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    if (new Date(row.createdAt).getTime() < cutoff) {
      await fsp.rm(path.join(backupDir, row.filename), { force: true });
    }
  }
};

export const createBackup = async (opts?: { manual?: boolean }) => {
  const settings = await getSetting('backup');
  await ensureDir(backupDir);
  const timestamp = formatTimestamp();
  const metaDir = path.join(backupDir, `.tmp-${timestamp}`);
  await ensureDir(metaDir);
  const metadata = {
    createdAt: new Date().toISOString(),
    includeUploads: settings.includeUploads,
    retentionDays: settings.retentionDays,
    manual: Boolean(opts?.manual),
    schedule: settings.schedule,
  };
  await fsp.writeFile(path.join(metaDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  try {
    await pgDump(path.join(metaDir, 'database.sql'));
  } catch (error: any) {
    await fsp.writeFile(
      path.join(metaDir, 'database-error.txt'),
      `Failed to run pg_dump. Ensure PostgreSQL client tools are installed.\n${error?.message || error}`,
    );
  }

  const zipName = `backup-${timestamp}.zip`;
  const zipPath = path.join(backupDir, zipName);
  const zip = new AdmZip();
  zip.addLocalFolder(metaDir, 'meta');
  const includeUploads = settings.includeUploads !== false;
  if (includeUploads && fs.existsSync(uploadsDir)) zip.addLocalFolder(uploadsDir, 'uploads');
  if (includeUploads && fs.existsSync(storageDir)) zip.addLocalFolder(storageDir, 'storage');
  if (fs.existsSync(sessionsDir)) zip.addLocalFolder(sessionsDir, 'whatsapp-sessions');
  zip.writeZip(zipPath);
  await fsp.rm(metaDir, { recursive: true, force: true });
  await enforceRetention(settings.retentionDays || 30);
  const stat = await fsp.stat(zipPath);
  return { filename: zipName, size: stat.size, createdAt: stat.birthtime.toISOString() } as BackupSummary;
};

export const getBackupFile = async (filename: string) => {
  const full = withinDir(backupDir, filename);
  const stat = await safeStat(full);
  if (!stat) throw new Error('Backup not found');
  return { path: full, stat };
};

export const restoreBackup = async (filename: string) => {
  const { path: filePath } = await getBackupFile(filename);
  await ensureDir(restoreDir);
  const target = path.join(restoreDir, `${path.parse(filename).name}-${formatTimestamp()}`);
  await ensureDir(target);
  const zip = new AdmZip(filePath);
  zip.extractAllTo(target, true);
  return { extractedTo: target };
};
