"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAppFunction = void 0;

// Minimal app function resolver for setup app
const resolveAppFunction = (appFnId) => {
    return require(appFnId);
};
exports.resolveAppFunction = resolveAppFunction;