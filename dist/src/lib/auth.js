import { betterAuth } from "better-auth";
import prisma from "./prisma.js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, phoneNumber, username, emailOTP } from "better-auth/plugins";
import sendEmail from "./resend.js";
import { sendSMS } from "./africatalking.js";
import { emailVerificationTemplate, passwordResetTemplate, signInOTPTemplate, } from "../utils/email-tempelates.js";
const envTrustedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
    },
    plugins: [
        username(),
        phoneNumber({
            otpLength: 6,
            expiresIn: 300,
            sendOTP: async ({ phoneNumber, code }) => {
                await sendSMS(phoneNumber, `Your InkingiPro verification code is: ${code}. Expires in 5 minutes.`);
            },
        }),
        emailOTP({
            otpLength: 6,
            expiresIn: 300,
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "email-verification") {
                    const template = emailVerificationTemplate(otp);
                    await sendEmail({ to: email, ...template });
                }
                else if (type === "forget-password") {
                    const template = passwordResetTemplate(otp);
                    await sendEmail({ to: email, ...template });
                }
                else if (type === "sign-in") {
                    const template = signInOTPTemplate(otp);
                    await sendEmail({ to: email, ...template });
                }
            },
        }),
        admin({
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
        "http://localhost:8081",
        "http://192.168.1.171:8081",
        ...envTrustedOrigins,
    ],
});
