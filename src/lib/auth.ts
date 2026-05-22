import { betterAuth } from "better-auth";
import prisma from "./prisma.js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, phoneNumber, username } from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  plugins: [admin(), username(), phoneNumber()],
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:5173"],
});
