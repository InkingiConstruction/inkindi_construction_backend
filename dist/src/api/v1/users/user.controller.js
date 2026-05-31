"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.createUser = exports.getSuppliers = exports.getSupervisors = exports.getEngineers = exports.updateCurrentUserRole = exports.updateCurrentUser = exports.getCurrentUser = void 0;
const client_1 = require("@prisma/client");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const getId = (id) => Array.isArray(id) ? id[0] : id;
const parseJson = (value) => {
    if (!value)
        return undefined;
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
};
const isKycStatus = (value) => typeof value === "string" &&
    Object.values(client_1.KycStatus).includes(value);
const allowedSelfRoles = ["client", "engineer", "supervisor", "supplier"];
const selectUser = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    role: true,
    banned: true,
    banReason: true,
    banExpires: true,
    username: true,
    displayUsername: true,
    phoneNumber: true,
    phoneNumberVerified: true,
    fcmToken: true,
    kycStatus: true,
    kycSubmittedAt: true,
    kycReviewedAt: true,
    kycRejectionReason: true,
    lastLoginAt: true,
    notificationPrefs: true,
    createdAt: true,
    updatedAt: true,
    kycDocuments: true,
};
const getCurrentUser = async (req, res) => {
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
        console.error("Get current user error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getCurrentUser = getCurrentUser;
const updateCurrentUser = async (req, res) => {
    try {
        const { name, image, role, username, displayUsername, phoneNumber, fcmToken, notificationPrefs, } = req.body;
        const nextRole = typeof role === "string" ? role.trim().toLowerCase() : undefined;
        if (nextRole && !allowedSelfRoles.includes(nextRole)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        const user = await db_js_1.default.user.update({
            where: { id: req.user.id },
            data: {
                name,
                image,
                role: nextRole,
                username,
                displayUsername,
                phoneNumber,
                fcmToken,
                notificationPrefs: notificationPrefs !== undefined
                    ? parseJson(notificationPrefs) || {}
                    : undefined,
            },
            select: selectUser,
        });
        return res.json({
            message: "User updated successfully",
            user,
        });
    }
    catch (error) {
        console.error("Update current user error:", error);
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            return res.status(409).json({ message: "Phone number or username already exists" });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateCurrentUser = updateCurrentUser;
const updateCurrentUserRole = async (req, res) => {
    try {
        const role = typeof req.body.role === "string"
            ? req.body.role.trim().toLowerCase()
            : undefined;
        if (!role || !allowedSelfRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        const user = await db_js_1.default.user.update({
            where: { id: req.user.id },
            data: { role },
            select: selectUser,
        });
        return res.json({
            message: "Role updated successfully",
            user,
        });
    }
    catch (error) {
        console.error("Update current user role error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateCurrentUserRole = updateCurrentUserRole;
const getEngineers = async (_req, res) => {
    try {
        const engineers = await db_js_1.default.user.findMany({
            where: {
                role: "engineer",
                banned: false,
            },
            select: {
                ...selectUser,
                kycDocuments: false,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json(engineers);
    }
    catch (error) {
        console.error("Get engineers error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getEngineers = getEngineers;
const getUsersByRole = async (role, res) => {
    const users = await db_js_1.default.user.findMany({
        where: {
            role,
            banned: false,
        },
        select: {
            ...selectUser,
            kycDocuments: false,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return res.json(users);
};
const getSupervisors = async (_req, res) => {
    try {
        return await getUsersByRole("supervisor", res);
    }
    catch (error) {
        console.error("Get supervisors error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getSupervisors = getSupervisors;
const getSuppliers = async (_req, res) => {
    try {
        return await getUsersByRole("supplier", res);
    }
    catch (error) {
        console.error("Get suppliers error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getSuppliers = getSuppliers;
const createUser = async (req, res) => {
    try {
        const { id, name, email, emailVerified, image, role, username, displayUsername, phoneNumber, phoneNumberVerified, fcmToken, notificationPrefs, } = req.body;
        if (!id || !name || !email) {
            return res.status(400).json({ message: "id, name and email are required" });
        }
        const user = await db_js_1.default.user.create({
            data: {
                id,
                name,
                email,
                emailVerified: Boolean(emailVerified),
                image,
                role: role || "client",
                username,
                displayUsername,
                phoneNumber,
                phoneNumberVerified: phoneNumberVerified !== undefined
                    ? Boolean(phoneNumberVerified)
                    : undefined,
                fcmToken,
                notificationPrefs: parseJson(notificationPrefs) || {},
            },
            select: selectUser,
        });
        return res.status(201).json({
            message: "User created successfully",
            user,
        });
    }
    catch (error) {
        console.error("Create user error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createUser = createUser;
const getUsers = async (req, res) => {
    try {
        const role = typeof req.query.role === "string" ? req.query.role : undefined;
        const kycStatus = typeof req.query.kycStatus === "string" ? req.query.kycStatus : undefined;
        if (kycStatus !== undefined && !isKycStatus(kycStatus)) {
            return res.status(400).json({ message: "Invalid KYC status" });
        }
        const users = await db_js_1.default.user.findMany({
            where: {
                ...(role ? { role } : {}),
                ...(kycStatus ? { kycStatus } : {}),
            },
            select: selectUser,
            orderBy: { createdAt: "desc" },
        });
        return res.json(users);
    }
    catch (error) {
        console.error("Get users error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "User ID is required" });
        }
        const user = await db_js_1.default.user.findUnique({
            where: { id },
            select: {
                ...selectUser,
                accounts: true,
                sessions: true,
                apiKeys: true,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json(user);
    }
    catch (error) {
        console.error("Get user by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getUserById = getUserById;
const updateUser = async (req, res) => {
    try {
        const id = getId(req.params.id);
        const { name, email, emailVerified, image, role, banned, banReason, banExpires, username, displayUsername, phoneNumber, phoneNumberVerified, fcmToken, kycStatus, kycRejectionReason, notificationPrefs, } = req.body;
        if (!id) {
            return res.status(400).json({ message: "User ID is required" });
        }
        if (kycStatus !== undefined && !isKycStatus(kycStatus)) {
            return res.status(400).json({ message: "Invalid KYC status" });
        }
        const user = await db_js_1.default.user.update({
            where: { id },
            data: {
                name,
                email,
                emailVerified: emailVerified !== undefined ? Boolean(emailVerified) : undefined,
                image,
                role,
                banned: banned !== undefined ? Boolean(banned) : undefined,
                banReason,
                banExpires: banExpires !== undefined
                    ? banExpires
                        ? new Date(banExpires)
                        : null
                    : undefined,
                username,
                displayUsername,
                phoneNumber,
                phoneNumberVerified: phoneNumberVerified !== undefined
                    ? Boolean(phoneNumberVerified)
                    : undefined,
                fcmToken,
                kycStatus,
                kycRejectionReason,
                notificationPrefs: notificationPrefs !== undefined
                    ? parseJson(notificationPrefs) || {}
                    : undefined,
            },
            select: selectUser,
        });
        return res.json({
            message: "User updated successfully",
            user,
        });
    }
    catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const id = getId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "User ID is required" });
        }
        await db_js_1.default.user.delete({ where: { id } });
        return res.json({ message: "User deleted successfully" });
    }
    catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteUser = deleteUser;
