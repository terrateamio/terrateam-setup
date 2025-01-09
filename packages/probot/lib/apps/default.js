"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultApp = void 0;
const path_1 = __importDefault(require("path"));
function defaultApp(app, { getRouter }) {
    const router = getRouter();
    router.get("/", (req, res, next) => res.redirect("/probot"));
}
exports.defaultApp = defaultApp;
//# sourceMappingURL=default.js.map
