"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const better_auth_1 = require("better-auth");
const db_js_1 = __importDefault(require("./db.js"));
const prisma_1 = require("better-auth/adapters/prisma");
const plugins_1 = require("better-auth/plugins");
const expo_1 = require("@better-auth/expo");
const resend_js_1 = require("../integrations/resend.js");
const africastalking_js_1 = require("../integrations/africastalking.js");
const email_tempelates_js_1 = require("../utils/email-tempelates.js");
const envTrustedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const usesHttpsAuthUrl = process.env.BETTER_AUTH_URL?.startsWith("https://");
exports.auth = (0, better_auth_1.betterAuth)({
    basePath: "/api/v1/auth",
    advanced: {
        useSecureCookies: Boolean(usesHttpsAuthUrl),
        defaultCookieAttributes: usesHttpsAuthUrl
            ? {
                sameSite: "none",
                secure: true,
            }
            : undefined,
    },
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
    },
    database: (0, prisma_1.prismaAdapter)(db_js_1.default, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
    },
    plugins: [
        (0, plugins_1.bearer)(),
        (0, expo_1.expo)(),
        (0, plugins_1.username)(),
        (0, plugins_1.phoneNumber)({
            otpLength: 6,
            expiresIn: 300,
            sendOTP: async ({ phoneNumber, code }) => {
                await (0, africastalking_js_1.sendSMS)(phoneNumber, `Your InkingiPro verification code is: ${code}. Expires in 5 minutes.`);
            },
        }),
        (0, plugins_1.emailOTP)({
            otpLength: 6,
            expiresIn: 300,
            sendVerificationOnSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                console.log("Better Auth email OTP requested:", { email, type });
                if (type === "email-verification") {
                    const template = (0, email_tempelates_js_1.emailVerificationTemplate)(otp);
                    await (0, resend_js_1.sendEmail)({ to: email, ...template });
                }
                else if (type === "forget-password") {
                    const template = (0, email_tempelates_js_1.passwordResetTemplate)(otp);
                    await (0, resend_js_1.sendEmail)({ to: email, ...template });
                }
                else if (type === "sign-in") {
                    const template = (0, email_tempelates_js_1.signInOTPTemplate)(otp);
                    await (0, resend_js_1.sendEmail)({ to: email, ...template });
                }
            },
        }),
        (0, plugins_1.admin)({
            defaultRole: "client",
            adminRoles: ["admin"],
        }),
    ],
    trustedOrigins: [
        process.env.FRONTEND_URL,
        process.env.MOBILE_URL,
        process.env.BETTER_AUTH_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8081",
        "http://192.168.1.171:8081",
        "inkindiapp://",
        "inkindiapp://*",
        ...(process.env.NODE_ENV === "development"
            ? [
                "exp://",
                "exp://**",
                "exp://192.168.*.*:*/**",
                "exp://10.*.*.*:*/**",
                "exp://172.*.*.*:*/**",
            ]
            : []),
        "https://inkindi-construction-backend.onrender.com",
        ...envTrustedOrigins,
    ].filter(Boolean),
});
