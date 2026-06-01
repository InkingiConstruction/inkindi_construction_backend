"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.changePassword = exports.getMe = exports.resendOtp = exports.verifyEmail = exports.login = exports.register = void 0;
const crypto_1 = require("crypto");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const mobile_jwt_js_1 = require("../../../utils/mobile-jwt.js");
const password_js_1 = require("../../../utils/password.js");
const resend_js_1 = require("../../../integrations/resend.js");
const email_tempelates_js_1 = require("../../../utils/email-tempelates.js");
const allowedRoles = ["client", "engineer", "supervisor", "supplier", "admin"];
const selectUser = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    role: true,
    banned: true,
    username: true,
    displayUsername: true,
    phoneNumber: true,
    phoneNumberVerified: true,
    kycStatus: true,
    kycRejectionReason: true,
    createdAt: true,
    updatedAt: true,
};
const sanitizeRole = (role) => {
    const nextRole = typeof role === "string" ? role.trim().toLowerCase() : "client";
    return allowedRoles.includes(nextRole) ? nextRole : null;
};
const createToken = (user) => (0, mobile_jwt_js_1.createMobileJwt)({ sub: user.id, role: user.role });
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const sendVerificationOtp = async (user) => {
    const otp = generateOtp();
    await db_js_1.default.authOtp.create({
        data: {
            userId: user.id,
            email: user.email,
            codeHash: (0, password_js_1.hashOtp)(otp),
            type: "email-verification",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
    });
    const template = (0, email_tempelates_js_1.emailVerificationTemplate)(otp);
    await (0, resend_js_1.sendEmail)({ to: user.email, ...template });
};
const register = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const role = sanitizeRole(req.body.role);
        const phoneNumber = req.body.phoneNumber ? String(req.body.phoneNumber).trim() : undefined;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        if (!role) {
            return res.status(400).json({ message: "Invalid role" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }
        const existingUser = await db_js_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: "Email is already registered" });
        }
        const username = email.includes("@") ? email.split("@")[0] : email;
        const passwordHash = await (0, password_js_1.hashPassword)(password);
        const user = await db_js_1.default.user.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                name,
                email,
                passwordHash,
                role,
                phoneNumber,
                phoneNumberVerified: Boolean(phoneNumber),
                username,
                displayUsername: username,
            },
            select: selectUser,
        });
        await sendVerificationOtp(user).catch((error) => {
            console.error("Send registration OTP error:", error);
        });
        return res.status(201).json({
            message: "Registered successfully",
            token: createToken(user),
            user,
        });
    }
    catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ message: "Registration failed" });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const user = await db_js_1.default.user.findUnique({
            where: { email },
            select: {
                ...selectUser,
                passwordHash: true,
            },
        });
        if (!user || !user.passwordHash) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const validPassword = await (0, password_js_1.verifyPassword)(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        if (user.banned) {
            return res.status(403).json({ message: "Account is suspended" });
        }
        await db_js_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const { passwordHash, ...safeUser } = user;
        return res.json({
            message: "Logged in successfully",
            token: createToken(safeUser),
            user: safeUser,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Login failed" });
    }
};
exports.login = login;
const verifyEmail = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const otp = String(req.body.otp || "").trim();
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }
        const verification = await db_js_1.default.authOtp.findFirst({
            where: {
                email,
                type: "email-verification",
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        if (!verification || verification.codeHash !== (0, password_js_1.hashOtp)(otp)) {
            if (verification) {
                await db_js_1.default.authOtp.update({
                    where: { id: verification.id },
                    data: { attempts: { increment: 1 } },
                });
            }
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        const user = await db_js_1.default.user.update({
            where: { email },
            data: { emailVerified: true },
            select: selectUser,
        });
        await db_js_1.default.authOtp.update({
            where: { id: verification.id },
            data: { usedAt: new Date() },
        });
        return res.json({
            message: "Email verified successfully",
            user,
        });
    }
    catch (error) {
        console.error("Verify email error:", error);
        return res.status(500).json({ message: "Email verification failed" });
    }
};
exports.verifyEmail = verifyEmail;
const resendOtp = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const user = await db_js_1.default.user.findUnique({
            where: { email },
            select: { id: true, email: true },
        });
        if (user) {
            await sendVerificationOtp(user);
        }
        return res.json({ message: "OTP sent successfully" });
    }
    catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(500).json({ message: "Failed to send OTP" });
    }
};
exports.resendOtp = resendOtp;
const getMe = async (req, res) => {
    try {
        const user = await db_js_1.default.user.findUnique({
            where: { id: req.user.id },
            select: selectUser,
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json(user);
    }
    catch (error) {
        console.error("Get me error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMe = getMe;
const changePassword = async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || "");
        const newPassword = String(req.body.newPassword || "");
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new password are required" });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: "New password must be at least 8 characters" });
        }
        const user = await db_js_1.default.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, passwordHash: true },
        });
        if (!user?.passwordHash) {
            return res.status(400).json({ message: "Password is not set for this account" });
        }
        const validPassword = await (0, password_js_1.verifyPassword)(currentPassword, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }
        await db_js_1.default.user.update({
            where: { id: user.id },
            data: { passwordHash: await (0, password_js_1.hashPassword)(newPassword) },
        });
        return res.json({ message: "Password changed successfully" });
    }
    catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({ message: "Failed to change password" });
    }
};
exports.changePassword = changePassword;
const logout = async (_req, res) => {
    return res.json({ message: "Logged out successfully" });
};
exports.logout = logout;
