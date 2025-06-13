"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addEventHandler = exports.webhookTransform = void 0;

// Minimal webhook transform for setup app
const webhookTransform = () => {
    return (event, eventPayload) => {
        return { event, payload: eventPayload };
    };
};
exports.webhookTransform = webhookTransform;

const addEventHandler = () => {
    // No-op for setup app
};
exports.addEventHandler = addEventHandler;