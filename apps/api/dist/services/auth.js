"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRefreshTokenValid = exports.revokeSession = exports.createSession = exports.hashPassword = exports.verifyPassword = exports.signRefreshToken = exports.signAccessToken = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const prisma_1 = __importDefault(require("../lib/prisma"));
const redis_1 = __importDefault(require("../lib/redis"));
const env_1 = __importDefault(require("../config/env"));
const time_1 = require("../utils/time");
const signAccessToken = (userId, role) => {
    const ttlMs = (0, time_1.parseDurationMs)(env_1.default.ACCESS_TOKEN_TTL);
    const token = jsonwebtoken_1.default.sign({ sub: userId, role }, env_1.default.JWT_ACCESS_SECRET, {
        expiresIn: Math.floor(ttlMs / 1000),
    });
    return token;
};
exports.signAccessToken = signAccessToken;
const signRefreshToken = async (userId, sessionId) => {
    const ttlMs = (0, time_1.parseDurationMs)(env_1.default.REFRESH_TOKEN_TTL);
    const jti = (0, node_crypto_1.randomUUID)();
    const token = jsonwebtoken_1.default.sign({ sub: userId, sid: sessionId, jti }, env_1.default.JWT_REFRESH_SECRET, {
        expiresIn: Math.floor(ttlMs / 1000),
    });
    // Store hashed token in DB for revocation checks
    const tokenHash = await bcryptjs_1.default.hash(token, 10);
    await prisma_1.default.refreshToken.create({
        data: {
            tokenHash,
            userId,
            sessionId,
            expiresAt: new Date(Date.now() + ttlMs),
        },
    });
    // Mark session active in Redis for fast checks
    await redis_1.default.set(`session:${sessionId}`, 'active', 'PX', ttlMs);
    return token;
};
exports.signRefreshToken = signRefreshToken;
const verifyPassword = async (plain, hash) => bcryptjs_1.default.compare(plain, hash);
exports.verifyPassword = verifyPassword;
const hashPassword = async (plain) => bcryptjs_1.default.hash(plain, 10);
exports.hashPassword = hashPassword;
const createSession = async (userId) => {
    const ttlMs = (0, time_1.parseDurationMs)(env_1.default.REFRESH_TOKEN_TTL);
    const session = await prisma_1.default.session.create({
        data: {
            userId,
            expiresAt: new Date(Date.now() + ttlMs),
        },
    });
    return session;
};
exports.createSession = createSession;
const revokeSession = async (sessionId) => {
    await prisma_1.default.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await prisma_1.default.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    await redis_1.default.del(`session:${sessionId}`);
};
exports.revokeSession = revokeSession;
const isRefreshTokenValid = async (token) => {
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.default.JWT_REFRESH_SECRET);
        // Check DB for token existence and non-revoked
        const tokens = await prisma_1.default.refreshToken.findMany({
            where: {
                sessionId: payload.sid,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
        });
        const match = await Promise.all(tokens.map((t) => bcryptjs_1.default.compare(token, t.tokenHash)));
        const matched = match.findIndex((v) => v === true);
        if (matched === -1)
            return null;
        const session = await prisma_1.default.session.findUnique({ where: { id: payload.sid } });
        if (!session || session.revokedAt || session.expiresAt < new Date())
            return null;
        const active = await redis_1.default.get(`session:${payload.sid}`);
        if (!active)
            return null;
        return { userId: payload.sub, sessionId: payload.sid };
    }
    catch {
        return null;
    }
};
exports.isRefreshTokenValid = isRefreshTokenValid;
