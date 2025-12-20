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
  email: z.string().email().optional(),
  username: z.string().optional(),
  password: z.string().min(6),
}).refine((data) => {
  // Either email or username must be provided
  return (data.email && data.email.length > 0) || (data.username && data.username.length > 0);
}, {
  message: "Email or username is required",
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const logoutSchema = z.object({ refreshToken: z.string().min(10) });

const loginHandler = async (req: import('express').Request, res: import('express').Response) => {
  console.log('[AUTH] Login attempt:', { body: req.body, headers: req.headers['content-type'] });
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log('[AUTH] Validation failed:', parsed.error.format());
    return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
  }
  const { email, username, password } = parsed.data;
  console.log('[AUTH] Validated credentials:', { identifier: email || username, passwordLength: password.length });

  let user;
  // Try to find user by email first if provided
  if (email) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  // If not found by email and username is provided, try username
  if (!user && username) {
    user = await prisma.user.findUnique({ where: { username } });
  }

  if (!user) {
    return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email, username, or password');
  }

  // Check user status
  if (user.status !== 'ACTIVE') {
    return sendAuthError(res, 401, 'ACCOUNT_INACTIVE', 'Account is not active. Please contact admin.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    console.log('[AUTH] Login failed for identifier:', email || username);
    return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email, username, or password');
  }

  console.log('[AUTH] Login successful for user:', {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status
  });

  const session = await createSession(user.id);
  const accessToken = signAccessToken(user.id, user.role as any);
  const refreshToken = await signRefreshToken(user.id, session.id);

  const accessTtl = parseDurationMs(env.ACCESS_TOKEN_TTL);
  const refreshTtl = parseDurationMs(env.REFRESH_TOKEN_TTL);

  res.cookie('access_token', accessToken, cookieOptions(accessTtl));
  res.cookie('refresh_token', refreshToken, cookieOptions(refreshTtl));

  return res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status
    },
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
    console.log('[AUTH] Token refresh failed: User not found for userId:', valid.userId);
    res.clearCookie('access_token', cookieOptions(0));
    res.clearCookie('refresh_token', cookieOptions(0));
    return sendAuthError(res, 401, 'USER_NOT_FOUND', 'User not found');
  }

  console.log('[AUTH] Token refresh successful for user:', {
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId: valid.sessionId
  });

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

const registerSchema = z.object({
  username: z.string().min(3, 'Username minimum 3 characters'),
  password: z.string().min(6, 'Password minimum 6 characters'),
  confirmPassword: z.string(),
  email: z.string().email('Invalid email format'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const registerHandler = async (req: import('express').Request, res: import('express').Response) => {
  console.log('[AUTH] Registration attempt:', { body: req.body });
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log('[AUTH] Registration validation failed:', parsed.error.format());
    return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
  }

  const { username, password, email, fullName, phone } = parsed.data;

  try {
    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return sendAuthError(res, 409, 'USERNAME_EXISTS', 'Username already exists');
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return sendAuthError(res, 409, 'EMAIL_EXISTS', 'Email already exists');
    }

    // Hash password
    const passwordHash = await new Promise<string>((resolve, reject) => {
      const bcrypt = require('bcrypt');
      bcrypt.hash(password, 10, (err: any, hash: string) => {
        if (err) reject(err);
        else resolve(hash);
      });
    });

    // Create user with PENDING status
    const user = await prisma.user.create({
      data: {
        username,
        email,
        name: fullName,
        passwordHash,
        role: 'USER',
        status: 'PENDING'
      }
    });

    console.log('[AUTH] User registered successfully:', { username, email, status: 'PENDING' });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully. Please wait for admin approval.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        status: user.status
      }
    });

  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    return sendAuthError(res, 500, 'REGISTRATION_FAILED', 'Failed to register user');
  }
};

const meHandler = async (req: import('express').Request, res: import('express').Response) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return sendAuthError(res, 404, 'USER_NOT_FOUND', 'User not found');
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status
    }
  });
};

router.post('/login', loginHandler);
router.post('/register', registerHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', requireAuth, meHandler);

export default router;
