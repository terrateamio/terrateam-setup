"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorHandler = void 0;

// Minimal error handler for setup app
const getErrorHandler = (log) => {
    return (error) => {
        log.error(error);
    };
};
exports.getErrorHandler = getErrorHandler;