"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const env_1 = __importDefault(require("../config/env"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const auth_2 = require("../services/auth");
const time_1 = require("../utils/time");
const router = (0, express_1.Router)();
const cookieOptions = (maxAge) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: env_1.default.NODE_ENV === 'production',
    maxAge,
    path: '/',
});
const sendAuthError = (res, status, errorCode, message, details) => res.status(status).json({ success: false, errorCode, message, details });
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const refreshSchema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
const logoutSchema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
const loginHandler = async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Email dan kata laluan diperlukan.', parsed.error.format());
    }
    const { email, password } = parsed.data;
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    if (!user) {
        return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const ok = await (0, auth_2.verifyPassword)(password, user.passwordHash);
    if (!ok) {
        return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const session = await (0, auth_2.createSession)(user.id);
    const accessToken = (0, auth_2.signAccessToken)(user.id, user.role);
    const refreshToken = await (0, auth_2.signRefreshToken)(user.id, session.id);
    const accessTtl = (0, time_1.parseDurationMs)(env_1.default.ACCESS_TOKEN_TTL);
    const refreshTtl = (0, time_1.parseDurationMs)(env_1.default.REFRESH_TOKEN_TTL);
    res.cookie('access_token', accessToken, cookieOptions(accessTtl));
    res.cookie('refresh_token', refreshToken, cookieOptions(refreshTtl));
    return res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
    });
};
const refreshHandler = async (req, res) => {
    const fromCookie = req.cookies?.refresh_token;
    const parsed = refreshSchema.safeParse(req.body);
    const passed = parsed.success ? parsed.data.refreshToken : undefined;
    const refreshToken = fromCookie || passed;
    if (!refreshToken) {
        return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Refresh token is required');
    }
    const valid = await (0, auth_2.isRefreshTokenValid)(refreshToken);
    if (!valid) {
        res.clearCookie('access_token', cookieOptions(0));
        res.clearCookie('refresh_token', cookieOptions(0));
        return sendAuthError(res, 401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }
    const user = await prisma_1.default.user.findUnique({ where: { id: valid.userId } });
    if (!user) {
        res.clearCookie('access_token', cookieOptions(0));
        res.clearCookie('refresh_token', cookieOptions(0));
        return sendAuthError(res, 401, 'USER_NOT_FOUND', 'User not found');
    }
    const accessToken = (0, auth_2.signAccessToken)(user.id, user.role);
    const accessTtl = (0, time_1.parseDurationMs)(env_1.default.ACCESS_TOKEN_TTL);
    res.cookie('access_token', accessToken, cookieOptions(accessTtl));
    return res.json({ success: true, accessToken });
};
const logoutHandler = async (req, res) => {
    const fromCookie = req.cookies?.refresh_token;
    const parsed = logoutSchema.safeParse(req.body);
    const passed = parsed.success ? parsed.data.refreshToken : undefined;
    const refreshToken = fromCookie || passed;
    if (!refreshToken) {
        res.clearCookie('access_token', cookieOptions(0));
        res.clearCookie('refresh_token', cookieOptions(0));
        return res.json({ success: true });
    }
    const valid = await (0, auth_2.isRefreshTokenValid)(refreshToken);
    if (!valid) {
        res.clearCookie('access_token', cookieOptions(0));
        res.clearCookie('refresh_token', cookieOptions(0));
        return res.status(200).json({ success: true });
    }
    await (0, auth_2.revokeSession)(valid.sessionId);
    res.clearCookie('access_token', cookieOptions(0));
    res.clearCookie('refresh_token', cookieOptions(0));
    return res.json({ success: true });
};
const meHandler = async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return sendAuthError(res, 404, 'USER_NOT_FOUND', 'User not found');
    return res.json({ success: true, id: user.id, email: user.email, name: user.name, role: user.role });
};
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', auth_1.requireAuth, meHandler);
exports.default = router;
