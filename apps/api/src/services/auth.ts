import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import prisma from '../lib/prisma';
import redis from '../lib/redis';
import env from '../config/env';
import { parseDurationMs } from '../utils/time';

type UserRole = 'ADMIN' | 'TECHNICIAN' | 'CASHIER' | 'MANAGER';

export const signAccessToken = (userId: string, role: UserRole) => {
  const ttlMs = parseDurationMs(env.ACCESS_TOKEN_TTL);
  const token = jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: Math.floor(ttlMs / 1000),
  });
  return token;
};

export const signRefreshToken = async (userId: string, sessionId: string) => {
  const ttlMs = parseDurationMs(env.REFRESH_TOKEN_TTL);
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, sid: sessionId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: Math.floor(ttlMs / 1000),
  });
  // Store hashed token in DB for revocation checks
  const tokenHash = await bcrypt.hash(token, 10);
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  // Mark session active in Redis for fast checks
  await redis.set(`session:${sessionId}`, 'active', 'PX', ttlMs);
  return token;
};

export const verifyPassword = async (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const createSession = async (userId: string) => {
  const ttlMs = parseDurationMs(env.REFRESH_TOKEN_TTL);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return session;
};

export const revokeSession = async (sessionId: string) => {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await prisma.refreshToken.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await redis.del(`session:${sessionId}`);
};

export const isRefreshTokenValid = async (token: string) => {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      sub: string;
      sid: string;
      jti?: string;
      exp?: number;
    };
    // Check DB for token existence and non-revoked
    const tokens = await prisma.refreshToken.findMany({
      where: {
        sessionId: payload.sid,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    const match = await Promise.all(tokens.map((t: { tokenHash: string }) => bcrypt.compare(token, t.tokenHash)));
    const matched = match.findIndex((v) => v === true);
    if (matched === -1) return null;

    const session = await prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    const active = await redis.get(`session:${payload.sid}`);
    if (!active) return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
};
