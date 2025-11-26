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
import env from '../config/env';
import { parseDurationMs } from '../utils/time';

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

  const accessTtl = parseDurationMs(env.ACCESS_TOKEN_TTL);
  const refreshTtl = parseDurationMs(env.REFRESH_TOKEN_TTL);
  const isProd = env.NODE_ENV === 'production';

  // Cookie settings optimized for cross-origin scenarios
  // In development with Next.js proxy, cookies work via same-origin requests
  // In production, ensure API and web app share the same domain or use explicit domain setting
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: accessTtl,
    path: '/',
    // Note: Setting domain explicitly can break localhost development
    // For production with subdomains, you may need: domain: '.yourdomain.com'
  };

  res.cookie('access_token', accessToken, cookieOptions);
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: refreshTtl,
  });

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });
router.post('/refresh', async (req, res) => {
  // Accept token from body or cookie
  const fromCookie = (req as any).cookies?.refresh_token as string | undefined;
  const parsed = refreshSchema.safeParse(req.body);
  const passed = parsed.success ? parsed.data.refreshToken : undefined;
  const refreshToken = fromCookie || passed;
  if (!refreshToken) return res.status(400).json({ message: 'Invalid payload' });

  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) return res.status(401).json({ message: 'Invalid refresh token' });

  const user = await prisma.user.findUnique({ where: { id: valid.userId } });
  if (!user) return res.status(401).json({ message: 'User not found' });

  const accessToken = signAccessToken(user.id, user.role as any);
  const accessTtl = parseDurationMs(env.ACCESS_TOKEN_TTL);
  const isProd = env.NODE_ENV === 'production';
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: accessTtl,
    path: '/',
  });
  return res.json({ accessToken });
});

const logoutSchema = z.object({ refreshToken: z.string().min(10) });
router.post('/logout', async (req, res) => {
  const fromCookie = (req as any).cookies?.refresh_token as string | undefined;
  const parsed = logoutSchema.safeParse(req.body);
  const passed = parsed.success ? parsed.data.refreshToken : undefined;
  const refreshToken = fromCookie || passed;
  
  const isProd = env.NODE_ENV === 'production';
  // Cookie clearing options must match the original cookie options (RFC 6265)
  // This ensures cookies are properly cleared, especially in production where secure: true
  const clearCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };
  
  if (!refreshToken) {
    // clear cookies regardless
    res.clearCookie('access_token', clearCookieOptions);
    res.clearCookie('refresh_token', clearCookieOptions);
    return res.json({ success: true });
  }
  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) {
    // Clear cookies even if token is invalid
    res.clearCookie('access_token', clearCookieOptions);
    res.clearCookie('refresh_token', clearCookieOptions);
    return res.status(200).json({ success: true }); // already invalid
  }
  await revokeSession(valid.sessionId);
  res.clearCookie('access_token', clearCookieOptions);
  res.clearCookie('refresh_token', clearCookieOptions);
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

export default router;
