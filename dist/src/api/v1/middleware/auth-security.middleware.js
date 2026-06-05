"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticatedUserRateLimit = void 0;
const USER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const USER_RATE_LIMIT_MAX = 100;
const userRateLimits = new Map();
const authenticatedUserRateLimit = (req, res, next) => {
    const userId = req.user?.id;
    if (!userId)
        return next();
    const now = Date.now();
    const state = userRateLimits.get(userId);
    if (!state || now - state.windowStart >= USER_RATE_LIMIT_WINDOW_MS) {
        userRateLimits.set(userId, {
            count: 1,
            windowStart: now,
        });
        return next();
    }
    if (state.count >= USER_RATE_LIMIT_MAX) {
        return res.status(429).json({
            message: "Too many requests",
            code: "RATE_LIMITED",
        });
    }
    state.count += 1;
    return next();
};
exports.authenticatedUserRateLimit = authenticatedUserRateLimit;
