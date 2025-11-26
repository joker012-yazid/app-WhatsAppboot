import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import prisma from '../lib/prisma';
import {
  createSession,
  isRefreshTokenValid,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  revokeSession,
} from '../services/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid email or password' });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

  const session = await createSession(user.id);
  const accessToken = signAccessToken(user.id, user.role as any);
  const refreshToken = await signRefreshToken(user.id, session.id);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });
router.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const { refreshToken } = parsed.data;

  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) return res.status(401).json({ message: 'Invalid refresh token' });

  const user = await prisma.user.findUnique({ where: { id: valid.userId } });
  if (!user) return res.status(401).json({ message: 'User not found' });

  const accessToken = signAccessToken(user.id, user.role as any);
  return res.json({ accessToken });
});

const logoutSchema = z.object({ refreshToken: z.string().min(10) });
router.post('/logout', async (req, res) => {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const { refreshToken } = parsed.data;
  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) return res.status(200).json({ success: true }); // already invalid
  await revokeSession(valid.sessionId);
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

export default router;

