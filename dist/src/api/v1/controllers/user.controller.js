"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.createUser = exports.getEngineers = void 0;
const prisma_js_1 = __importDefault(require("../../../lib/prisma.js"));
const getEngineers = async (req, res) => {
    try {
        const engineers = await prisma_js_1.default.user.findMany({
            where: {
                role: "engineer",
                banned: false,
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phoneNumber: true,
                username: true,
                displayUsername: true,
                kycStatus: true,
                createdAt: true,
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
const createUser = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createUser = createUser;
const getUsers = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getUserById = getUserById;
const updateUser = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteUser = deleteUser;
