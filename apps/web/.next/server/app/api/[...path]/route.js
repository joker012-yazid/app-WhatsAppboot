const CHUNK_PUBLIC_PATH = "server/app/api/[...path]/route.js";
const runtime = require("../../../chunks/[turbopack]_runtime.js");
runtime.loadChunk("server/chunks/08b5e_next_71c30d._.js");
runtime.loadChunk("server/chunks/src_app_api_[___path]_route_ts_3964fc._.js");
module.exports = runtime.getOrInstantiateRuntimeModule("[project]/node_modules/next/dist/esm/build/templates/app-route.js { INNER_APP_ROUTE => \"[project]/apps/web/src/app/api/[...path]/route.ts [app-route] (ecmascript)\" } [app-route] (ecmascript)", CHUNK_PUBLIC_PATH).exports;
