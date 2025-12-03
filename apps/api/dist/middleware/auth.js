"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = __importDefault(require("../config/env"));
const requireAuth = (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const bearer = hdr.startsWith('Bearer ') ? hdr.substring(7) : undefined;
    const cookieToken = req.cookies?.access_token;
    const token = bearer || cookieToken;
    if (!token)
        return res
            .status(401)
            .json({ success: false, errorCode: 'AUTH_REQUIRED', message: 'Missing Authorization header' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.default.JWT_ACCESS_SECRET);
        req.user = payload;
        return next();
    }
    catch (err) {
        return res
            .status(401)
            .json({ success: false, errorCode: 'INVALID_TOKEN', message: 'Invalid or expired token' });
    }
};
exports.requireAuth = requireAuth;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ success: false, errorCode: 'AUTH_REQUIRED', message: 'Unauthorized' });
        if (!roles.includes(req.user.role))
            return res.status(403).json({ success: false, errorCode: 'FORBIDDEN', message: 'Forbidden' });
        return next();
    };
};
exports.requireRole = requireRole;
