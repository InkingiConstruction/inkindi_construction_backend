import crypto from "crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export const hashPassword = (password: string) =>
  bcrypt.hash(password, SALT_ROUNDS);

export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const hashOtp = (otp: string) =>
  crypto
    .createHash("sha256")
    .update(
      `${otp}:${process.env.JWT_SECRET || process.env.MOBILE_JWT_SECRET || "inkingi"}`,
    )
    .digest("hex");
