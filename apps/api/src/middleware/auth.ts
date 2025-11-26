import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import env from '../config/env';

export type AccessPayload = {
  sub: string; // userId
  role: 'ADMIN' | 'TECHNICIAN' | 'CASHIER' | 'MANAGER';
  iat?: number;
  exp?: number;
};

declare global {
  namespace Express {
    // augment Request with user
    interface Request {
      user?: AccessPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.substring(7) : undefined;
  if (!token) return res.status(401).json({ message: 'Missing Authorization header' });
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: AccessPayload['role'][]) => {
  return (req: import('express').Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    return next();
  };
};

