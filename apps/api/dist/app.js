"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const routes_1 = __importDefault(require("./routes"));
// Get directory of current file for reliable path resolution
// Uses __dirname which is available at runtime in CommonJS
// This ensures the path is correct regardless of where the process starts
const getCurrentFileDir = () => {
    // At runtime in CommonJS, __dirname points to the directory of the compiled file
    // In development: apps/api/src (when using ts-node-dev)
    // In production: apps/api/dist (when running compiled JS)
    return __dirname;
};
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: true,
        credentials: true,
    }));
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, morgan_1.default)('dev'));
    // Static uploads (shared under repo root /uploads)
    // Resolve relative to this file's location, not process.cwd()
    // This ensures the path is correct regardless of where the process starts
    // __dirname points to apps/api/src (dev) or apps/api/dist (prod)
    const currentFileDir = getCurrentFileDir();
    const apiDir = node_path_1.default.resolve(currentFileDir, '..'); // apps/api
    const repoRoot = node_path_1.default.resolve(apiDir, '..'); // repo root
    const uploadsDir = node_path_1.default.resolve(repoRoot, 'uploads');
    if (!node_fs_1.default.existsSync(uploadsDir))
        node_fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    app.use('/uploads', express_1.default.static(uploadsDir));
    app.use('/api', routes_1.default);
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // Handle 404 - provide helpful message for common web app routes
    app.use((req, res) => {
        // Common Next.js routes that might be requested from API server
        const webAppRoutes = ['/login', '/dashboard', '/customers', '/devices', '/jobs'];
        if (webAppRoutes.includes(req.path)) {
            return res.status(404).json({
                message: `Route '${req.path}' is a web app route, not an API endpoint. Use '/api/*' for API endpoints.`,
                hint: `For authentication, use POST /api/auth/login instead of ${req.path}`,
            });
        }
        res.status(404).json({ message: 'Not found' });
    });
    return app;
};
exports.createApp = createApp;
