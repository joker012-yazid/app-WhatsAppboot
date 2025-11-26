"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../services/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const { email, password } = parsed.data;
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ message: 'Invalid email or password' });
    const ok = await (0, auth_1.verifyPassword)(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ message: 'Invalid email or password' });
    const session = await (0, auth_1.createSession)(user.id);
    const accessToken = (0, auth_1.signAccessToken)(user.id, user.role);
    const refreshToken = await (0, auth_1.signRefreshToken)(user.id, session.id);
    return res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
    });
});
const refreshSchema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
router.post('/refresh', async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const { refreshToken } = parsed.data;
    const valid = await (0, auth_1.isRefreshTokenValid)(refreshToken);
    if (!valid)
        return res.status(401).json({ message: 'Invalid refresh token' });
    const user = await prisma_1.default.user.findUnique({ where: { id: valid.userId } });
    if (!user)
        return res.status(401).json({ message: 'User not found' });
    const accessToken = (0, auth_1.signAccessToken)(user.id, user.role);
    return res.json({ accessToken });
});
const logoutSchema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
router.post('/logout', async (req, res) => {
    const parsed = logoutSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload' });
    const { refreshToken } = parsed.data;
    const valid = await (0, auth_1.isRefreshTokenValid)(refreshToken);
    if (!valid)
        return res.status(200).json({ success: true }); // already invalid
    await (0, auth_1.revokeSession)(valid.sessionId);
    return res.json({ success: true });
});
router.get('/me', auth_2.requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});
exports.default = router;
