"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashOtp = exports.verifyPassword = exports.hashPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const SALT_ROUNDS = 12;
const hashPassword = (password) => bcrypt_1.default.hash(password, SALT_ROUNDS);
exports.hashPassword = hashPassword;
const verifyPassword = (password, hash) => bcrypt_1.default.compare(password, hash);
exports.verifyPassword = verifyPassword;
const hashOtp = (otp) => crypto_1.default
    .createHash("sha256")
    .update(`${otp}:${process.env.JWT_SECRET || process.env.MOBILE_JWT_SECRET || "inkingi"}`)
    .digest("hex");
exports.hashOtp = hashOtp;
