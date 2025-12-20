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
    loginType: zod_1.z.enum(['ADMIN', 'USER']).default('USER'),
    email: zod_1.z.string().email().optional(),
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6),
}).refine((data) => {
    if (data.loginType === 'ADMIN') {
        return data.email && data.email.length > 0;
    }
    else {
        return data.username && data.username.length > 0;
    }
}, {
    message: "Email required for Admin, Username required for User",
    path: ["loginType"]
});
const refreshSchema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
const logoutSchema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
const loginHandler = async (req, res) => {
    console.log('[AUTH] Login attempt:', { body: req.body, headers: req.headers['content-type'] });
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        console.log('[AUTH] Validation failed:', parsed.error.format());
        return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
    }
    const { loginType, email, username, password } = parsed.data;
    console.log('[AUTH] Validated credentials:', { loginType, identifier: email || username, passwordLength: password.length });
    let user;
    if (loginType === 'ADMIN') {
        // Admin login with email
        if (!email) {
            return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Email required for Admin login');
        }
        user = await prisma_1.default.user.findUnique({ where: { email } });
    }
    else {
        // User login with username
        if (!username) {
            return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Username required for User login');
        }
        user = await prisma_1.default.user.findUnique({ where: { username } });
    }
    if (!user) {
        const field = loginType === 'ADMIN' ? 'email' : 'username';
        return sendAuthError(res, 401, 'INVALID_CREDENTIALS', `Invalid ${field} or password`);
    }
    // Check user status
    if (user.status !== 'ACTIVE') {
        return sendAuthError(res, 401, 'ACCOUNT_INACTIVE', 'Account is not active. Please contact admin.');
    }
    const ok = await (0, auth_2.verifyPassword)(password, user.passwordHash);
    if (!ok) {
        return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
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
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username minimum 3 characters'),
    password: zod_1.z.string().min(6, 'Password minimum 6 characters'),
    confirmPassword: zod_1.z.string(),
    email: zod_1.z.string().email('Invalid email format'),
    fullName: zod_1.z.string().min(1, 'Full name is required'),
    phone: zod_1.z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});
const registerHandler = async (req, res) => {
    console.log('[AUTH] Registration attempt:', { body: req.body });
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        console.log('[AUTH] Registration validation failed:', parsed.error.format());
        return sendAuthError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
    }
    const { username, password, email, fullName, phone } = parsed.data;
    try {
        // Check if username already exists
        const existingUsername = await prisma_1.default.user.findUnique({ where: { username } });
        if (existingUsername) {
            return sendAuthError(res, 409, 'USERNAME_EXISTS', 'Username already exists');
        }
        // Check if email already exists
        const existingEmail = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingEmail) {
            return sendAuthError(res, 409, 'EMAIL_EXISTS', 'Email already exists');
        }
        // Hash password
        const passwordHash = await new Promise((resolve, reject) => {
            const bcrypt = require('bcrypt');
            bcrypt.hash(password, 10, (err, hash) => {
                if (err)
                    reject(err);
                else
                    resolve(hash);
            });
        });
        // Create user with PENDING status
        const user = await prisma_1.default.user.create({
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
    }
    catch (error) {
        console.error('[AUTH] Registration error:', error);
        return sendAuthError(res, 500, 'REGISTRATION_FAILED', 'Failed to register user');
    }
};
const meHandler = async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return sendAuthError(res, 404, 'USER_NOT_FOUND', 'User not found');
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
router.get('/me', auth_1.requireAuth, meHandler);
exports.default = router;
