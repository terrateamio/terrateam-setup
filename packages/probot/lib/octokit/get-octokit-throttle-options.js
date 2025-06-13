"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOctokitThrottleOptions = void 0;

// Minimal throttle options for setup app
const getOctokitThrottleOptions = () => ({
    throttle: {
        enabled: false
    }
});
exports.getOctokitThrottleOptions = getOctokitThrottleOptions;