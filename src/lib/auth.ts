import { betterAuth } from "better-auth";
import prisma from "./prisma.js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, phoneNumber, username, emailOTP } from "better-auth/plugins";
import sendEmail from "./resend.js";
import { sendSMS } from "./africatalking.js";
import {
  emailVerificationTemplate,
  passwordResetTemplate,
  signInOTPTemplate,
} from "../utils/email-tempelates.js";

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
        await sendSMS(
          phoneNumber,
          `Your InkingiPro verification code is: ${code}. Expires in 5 minutes.`,
        );
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification") {
          const template = emailVerificationTemplate(otp);
          await sendEmail({ to: email, ...template });
        } else if (type === "forget-password") {
          const template = passwordResetTemplate(otp);
          await sendEmail({ to: email, ...template });
        } else if (type === "sign-in") {
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
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:5173"],
});

export type AppRole =
  | "client"
  | "engineer"
  | "supervisor"
  | "supplier"
  | "admin";

export type Auth = typeof auth;
