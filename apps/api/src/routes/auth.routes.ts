import { Router } from 'express';
import { z } from 'zod';

import env from '../config/env';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import {
  createSession,
  isRefreshTokenValid,
  revokeSession,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
} from '../services/auth';
import { parseDurationMs } from '../utils/time';

const router = Router();

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  maxAge,
  path: '/',
});

const sendAuthError = (
  res: import('express').Response,
  status: number,
  errorCode: string,
  message: string,
  details?: unknown,
) => res.status(status).json({ success: false, errorCode, message, details });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const logoutSchema = z.object({ refreshToken: z.string().min(10) });

const loginHandler = async (req: import('express').Request, res: import('express').Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Email dan kata laluan diperlukan.', parsed.error.format());
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const session = await createSession(user.id);
  const accessToken = signAccessToken(user.id, user.role as any);
  const refreshToken = await signRefreshToken(user.id, session.id);

  const accessTtl = parseDurationMs(env.ACCESS_TOKEN_TTL);
  const refreshTtl = parseDurationMs(env.REFRESH_TOKEN_TTL);

  res.cookie('access_token', accessToken, cookieOptions(accessTtl));
  res.cookie('refresh_token', refreshToken, cookieOptions(refreshTtl));

  return res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
};

const refreshHandler = async (req: import('express').Request, res: import('express').Response) => {
  const fromCookie = (req as any).cookies?.refresh_token as string | undefined;
  const parsed = refreshSchema.safeParse(req.body);
  const passed = parsed.success ? parsed.data.refreshToken : undefined;
  const refreshToken = fromCookie || passed;
  if (!refreshToken) {
    return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Refresh token is required');
  }

  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) {
    res.clearCookie('access_token', cookieOptions(0));
    res.clearCookie('refresh_token', cookieOptions(0));
    return sendAuthError(res, 401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: valid.userId } });
  if (!user) {
    res.clearCookie('access_token', cookieOptions(0));
    res.clearCookie('refresh_token', cookieOptions(0));
    return sendAuthError(res, 401, 'USER_NOT_FOUND', 'User not found');
  }

  const accessToken = signAccessToken(user.id, user.role as any);
  const accessTtl = parseDurationMs(env.ACCESS_TOKEN_TTL);
  res.cookie('access_token', accessToken, cookieOptions(accessTtl));
  return res.json({ success: true, accessToken });
};

const logoutHandler = async (req: import('express').Request, res: import('express').Response) => {
  const fromCookie = (req as any).cookies?.refresh_token as string | undefined;
  const parsed = logoutSchema.safeParse(req.body);
  const passed = parsed.success ? parsed.data.refreshToken : undefined;
  const refreshToken = fromCookie || passed;

  if (!refreshToken) {
    res.clearCookie('access_token', cookieOptions(0));
    res.clearCookie('refresh_token', cookieOptions(0));
    return res.json({ success: true });
  }

  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) {
    res.clearCookie('access_token', cookieOptions(0));
    res.clearCookie('refresh_token', cookieOptions(0));
    return res.status(200).json({ success: true });
  }

  await revokeSession(valid.sessionId);
  res.clearCookie('access_token', cookieOptions(0));
  res.clearCookie('refresh_token', cookieOptions(0));
  return res.json({ success: true });
};

const meHandler = async (req: import('express').Request, res: import('express').Response) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return sendAuthError(res, 404, 'USER_NOT_FOUND', 'User not found');
  return res.json({ success: true, id: user.id, email: user.email, name: user.name, role: user.role });
};

router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', requireAuth, meHandler);

export default router;
