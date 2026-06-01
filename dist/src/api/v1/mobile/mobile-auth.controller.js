"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMobileMe = exports.verifyMobileEmail = exports.loginMobileUser = exports.registerMobileUser = void 0;
const auth_js_1 = require("../../../config/auth.js");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const mobile_jwt_js_1 = require("../../../utils/mobile-jwt.js");
const allowedRoles = ["client", "engineer", "supervisor", "supplier"];
const authHeaders = () => new Headers({
    origin: "inkindiapp://",
    "expo-origin": "inkindiapp://",
    "x-skip-oauth-proxy": "true",
});
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
const getMobileUser = (id) => db_js_1.default.user.findUnique({
    where: { id },
    select: selectUser,
});
const registerMobileUser = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const phoneNumber = req.body.phoneNumber
            ? String(req.body.phoneNumber).trim()
            : undefined;
        const role = String(req.body.role || "client").trim().toLowerCase();
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        const result = await auth_js_1.auth.api.signUpEmail({
            body: {
                name,
                email,
                password,
                rememberMe: true,
            },
            headers: authHeaders(),
        });
        const username = email.includes("@") ? email.split("@")[0] : email;
        const user = await db_js_1.default.user.update({
            where: { id: result.user.id },
            data: {
                role,
                phoneNumber,
                phoneNumberVerified: Boolean(phoneNumber),
                username,
                displayUsername: username,
            },
            select: selectUser,
        });
        return res.status(201).json({
            message: "Registered successfully",
            token: (0, mobile_jwt_js_1.createMobileJwt)({ sub: user.id, role: user.role }),
            user,
        });
    }
    catch (error) {
        console.error("Mobile register error:", error);
        return res.status(error?.statusCode || 500).json({
            message: error?.body?.message || error?.message || "Registration failed",
        });
    }
};
exports.registerMobileUser = registerMobileUser;
const loginMobileUser = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const result = await auth_js_1.auth.api.signInEmail({
            body: {
                email,
                password,
                rememberMe: true,
            },
            headers: authHeaders(),
        });
        const user = await getMobileUser(result.user.id);
        return res.json({
            message: "Logged in successfully",
            token: user ? (0, mobile_jwt_js_1.createMobileJwt)({ sub: user.id, role: user.role }) : null,
            user,
        });
    }
    catch (error) {
        console.error("Mobile login error:", error);
        return res.status(error?.statusCode || 401).json({
            message: error?.body?.message || error?.message || "Invalid email or password",
        });
    }
};
exports.loginMobileUser = loginMobileUser;
const verifyMobileEmail = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const otp = String(req.body.otp || "").trim();
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }
        await auth_js_1.auth.api.verifyEmailOTP({
            body: { email, otp },
            headers: authHeaders(),
        });
        const user = await db_js_1.default.user.findUnique({
            where: { email },
            select: selectUser,
        });
        return res.json({
            message: "Email verified successfully",
            user,
        });
    }
    catch (error) {
        console.error("Mobile verify email error:", error);
        return res.status(error?.statusCode || 400).json({
            message: error?.body?.message || error?.message || "Email verification failed",
        });
    }
};
exports.verifyMobileEmail = verifyMobileEmail;
const getMobileMe = async (req, res) => {
    try {
        const user = await getMobileUser(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json(user);
    }
    catch (error) {
        console.error("Mobile me error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMobileMe = getMobileMe;
