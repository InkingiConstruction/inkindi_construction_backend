"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMtnMomoDeposit = exports.createStripeDeposit = exports.deleteEscrowAccount = exports.updateEscrowAccount = exports.getEscrowAccountById = exports.getEscrowAccounts = exports.createEscrowAccount = void 0;
const client_1 = require("@prisma/client");
const db_js_1 = __importDefault(require("../../../config/db.js"));
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const canReadProjectEscrow = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const createEscrowAccount = async (req, res) => {
    try {
        const { projectId, currency, balance, lockedBalance } = req.body;
        if (!projectId) {
            return res.status(400).json({ message: "projectId is required" });
        }
        const project = await db_js_1.default.project.findUnique({
            where: { id: String(projectId) },
            include: {
                escrowAccount: true,
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (project.escrowAccount) {
            return res.status(409).json({
                message: "Project already has an escrow account",
                escrowAccount: project.escrowAccount,
            });
        }
        const escrowAccount = await db_js_1.default.escrowAccount.create({
            data: {
                projectId: project.id,
                currency: currency || project.currency,
                balance: balance !== undefined ? new client_1.Prisma.Decimal(balance) : undefined,
                lockedBalance: lockedBalance !== undefined
                    ? new client_1.Prisma.Decimal(lockedBalance)
                    : undefined,
            },
            include: {
                project: true,
                transactions: true,
            },
        });
        return res.status(201).json({
            message: "Escrow account created successfully",
            escrowAccount,
        });
    }
    catch (error) {
        console.error("Create escrow account error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createEscrowAccount = createEscrowAccount;
const getEscrowAccounts = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const escrowAccounts = await db_js_1.default.escrowAccount.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : {
                        project: {
                            OR: [
                                { clientId: req.user.id },
                                { engineerId: req.user.id },
                                {
                                    projectMembers: {
                                        some: {
                                            userId: req.user.id,
                                            status: "accepted",
                                        },
                                    },
                                },
                            ],
                        },
                    }),
            },
            include: {
                project: true,
                transactions: {
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(escrowAccounts);
    }
    catch (error) {
        console.error("Get escrow accounts error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getEscrowAccounts = getEscrowAccounts;
const getEscrowAccountById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Escrow account ID is required" });
        }
        const escrowAccount = await db_js_1.default.escrowAccount.findUnique({
            where: { id },
            include: {
                project: {
                    include: {
                        projectMembers: true,
                    },
                },
                transactions: {
                    include: {
                        milestone: true,
                        actor: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                image: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!escrowAccount) {
            return res.status(404).json({ message: "Escrow account not found" });
        }
        if (!canReadProjectEscrow(escrowAccount.project, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "You do not have access to this escrow account",
            });
        }
        return res.json(escrowAccount);
    }
    catch (error) {
        console.error("Get escrow account by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getEscrowAccountById = getEscrowAccountById;
const updateEscrowAccount = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { currency, balance, lockedBalance } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Escrow account ID is required" });
        }
        const existingEscrowAccount = await db_js_1.default.escrowAccount.findUnique({
            where: { id },
        });
        if (!existingEscrowAccount) {
            return res.status(404).json({ message: "Escrow account not found" });
        }
        const escrowAccount = await db_js_1.default.escrowAccount.update({
            where: { id },
            data: {
                currency,
                balance: balance !== undefined ? new client_1.Prisma.Decimal(balance) : undefined,
                lockedBalance: lockedBalance !== undefined
                    ? new client_1.Prisma.Decimal(lockedBalance)
                    : undefined,
            },
            include: {
                project: true,
                transactions: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        return res.json({
            message: "Escrow account updated successfully",
            escrowAccount,
        });
    }
    catch (error) {
        console.error("Update escrow account error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateEscrowAccount = updateEscrowAccount;
const deleteEscrowAccount = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Escrow account ID is required" });
        }
        const escrowAccount = await db_js_1.default.escrowAccount.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        transactions: true,
                    },
                },
            },
        });
        if (!escrowAccount) {
            return res.status(404).json({ message: "Escrow account not found" });
        }
        if (escrowAccount._count.transactions > 0) {
            return res.status(400).json({
                message: "Escrow account with transactions cannot be deleted",
            });
        }
        await db_js_1.default.escrowAccount.delete({
            where: { id },
        });
        return res.json({ message: "Escrow account deleted successfully" });
    }
    catch (error) {
        console.error("Delete escrow account error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteEscrowAccount = deleteEscrowAccount;
const escrow_service_1 = require("./escrow.service");
/**
 * @swagger
 * /api/v1/escrow-accounts/{id}/deposit-stripe:
 *   post:
 *     summary: Initialize a Stripe deposit for an escrow account
 *     tags: [Escrow]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       200:
 *         description: Successfully created Stripe Payment Intent
 */
const createStripeDeposit = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { amount, currency } = req.body;
        const numericAmount = Number(amount);
        if (!id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: "Account ID and amount are required" });
        }
        const escrow = await db_js_1.default.escrowAccount.findUnique({
            where: { id },
            include: {
                project: {
                    select: {
                        clientId: true,
                        currency: true,
                    },
                },
            },
        });
        if (!escrow) {
            return res.status(404).json({ message: "Escrow account not found" });
        }
        if (req.user.role !== "admin" && escrow.project.clientId !== req.user.id) {
            return res.status(403).json({ message: "Only the project owner can fund this escrow account" });
        }
        const intent = await escrow_service_1.EscrowService.createStripePaymentIntent(numericAmount, currency || escrow.currency || escrow.project.currency, id, req.user.id);
        return res.json({ message: "Stripe Payment Intent created", data: intent });
    }
    catch (error) {
        console.error("Stripe deposit error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createStripeDeposit = createStripeDeposit;
/**
 * @swagger
 * /api/v1/escrow-accounts/{id}/deposit-mtn:
 *   post:
 *     summary: Initialize an MTN Momo deposit for an escrow account
 *     tags: [Escrow]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully initiated MTN Momo prompt
 */
const createMtnMomoDeposit = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { amount, phoneNumber } = req.body;
        if (!id || !amount || !phoneNumber) {
            return res.status(400).json({ message: "Account ID, amount, and phone number are required" });
        }
        const result = await escrow_service_1.EscrowService.initiateMtnMomoDeposit(Number(amount), phoneNumber, id, req.user.id);
        return res.json({ message: "MTN Momo prompt initiated", data: result });
    }
    catch (error) {
        console.error("MTN Momo deposit error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createMtnMomoDeposit = createMtnMomoDeposit;
