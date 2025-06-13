"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedOctokit = exports.auth = void 0;

// Minimal auth stub for setup app
const auth = async () => {
    throw new Error("Authentication not supported in setup mode");
};
exports.auth = auth;

const getAuthenticatedOctokit = async () => {
    throw new Error("Authentication not supported in setup mode");
};
exports.getAuthenticatedOctokit = getAuthenticatedOctokit;