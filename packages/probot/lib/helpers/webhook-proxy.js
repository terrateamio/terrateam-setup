"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookProxy = void 0;

// Minimal webhook proxy stub for setup app
const createWebhookProxy = () => {
    return {
        close: () => {},
        url: null
    };
};
exports.createWebhookProxy = createWebhookProxy;