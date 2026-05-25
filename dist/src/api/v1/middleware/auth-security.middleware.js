"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticatedUserRateLimit = exports.emailSignInLockout = void 0;
const auth_js_1 = require("../../../lib/auth.js");
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const USER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const USER_RATE_LIMIT_MAX = 100;
const failedSignIns = new Map();
const userRateLimits = new Map();
const normalizeEmail = (email) => typeof email === "string" ? email.trim().toLowerCase() : "";
const getRequestUrl = (req) => `${req.protocol}://${req.get("host")}${req.originalUrl}`;
const getForwardHeaders = (req) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined)
            continue;
        if (key.toLowerCase() === "content-length")
            continue;
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    headers.set("content-type", "application/json");
    return headers;
};
const sendAuthResponse = async (authResponse, res) => {
    authResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") {
            res.setHeader(key, value);
        }
    });
    const getSetCookie = authResponse.headers.getSetCookie;
    const cookies = getSetCookie?.call(authResponse.headers) || [];
    if (cookies.length > 0) {
        res.setHeader("set-cookie", cookies);
    }
    else {
        const cookie = authResponse.headers.get("set-cookie");
        if (cookie)
            res.setHeader("set-cookie", cookie);
    }
    const body = await authResponse.text();
    return res.status(authResponse.status).send(body);
};
const emailSignInLockout = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const now = Date.now();
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const state = failedSignIns.get(email);
        if (state?.lockedUntil && state.lockedUntil > now) {
            return res.status(423).json({
                message: "Account temporarily locked after 5 failed sign-in attempts",
                code: "ACCOUNT_LOCKED",
                lockedUntil: new Date(state.lockedUntil).toISOString(),
            });
        }
        const authResponse = await auth_js_1.auth.handler(new Request(getRequestUrl(req), {
            method: "POST",
            headers: getForwardHeaders(req),
            body: JSON.stringify(req.body),
        }));
        if (authResponse.status >= 400) {
            const nextCount = (state?.count || 0) + 1;
            const nextState = {
                count: nextCount,
                lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS
                    ? now + LOCKOUT_WINDOW_MS
                    : undefined,
            };
            failedSignIns.set(email, nextState);
        }
        else {
            failedSignIns.delete(email);
        }
        return sendAuthResponse(authResponse, res);
    }
    catch (error) {
        console.error("Email sign-in lockout error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.emailSignInLockout = emailSignInLockout;
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
        const retryAfter = Math.ceil((USER_RATE_LIMIT_WINDOW_MS - (now - state.windowStart)) / 1000);
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
            message: "Too many requests",
            code: "RATE_LIMITED",
            limit: USER_RATE_LIMIT_MAX,
            windowSeconds: USER_RATE_LIMIT_WINDOW_MS / 1000,
            retryAfter,
        });
    }
    state.count += 1;
    userRateLimits.set(userId, state);
    return next();
};
exports.authenticatedUserRateLimit = authenticatedUserRateLimit;
