"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBoqItem = exports.updateBoqItem = exports.getBoqItemById = exports.getBoqItems = exports.createBoqItem = void 0;
const db_js_1 = __importDefault(require("../../../config/db.js"));
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const canReadProject = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (project.clientId === userId)
        return true;
    if (project.engineerId === userId)
        return true;
    return Boolean(project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const canManageBoq = (milestone, userId, role) => {
    if (role === "admin")
        return true;
    return role === "engineer" && milestone.engineerId === userId;
};
const calculateTotalPrice = (quantity, unitPrice) => Number(quantity) * Number(unitPrice);
const buildBoqUpdateData = (body, current) => {
    const data = {};
    const quantity = body.quantity !== undefined
        ? Number(body.quantity)
        : Number(current.quantity);
    const unitPrice = Number(current.unitPrice);
    if (body.category !== undefined)
        data.category = String(body.category);
    if (body.name !== undefined)
        data.name = String(body.name);
    if (body.quantity !== undefined)
        data.quantity = String(body.quantity);
    if (body.unit !== undefined)
        data.unit = String(body.unit);
    if (body.actualCost !== undefined) {
        data.actualCost = body.actualCost ? String(body.actualCost) : null;
    }
    if (body.notes !== undefined)
        data.notes = body.notes ? String(body.notes) : null;
    if (body.totalPrice !== undefined) {
        data.totalPrice = String(body.totalPrice);
    }
    else if (body.quantity !== undefined) {
        data.totalPrice = String(calculateTotalPrice(quantity, unitPrice));
    }
    return data;
};
const createBoqItem = async (req, res) => {
    try {
        const { milestoneId, supplierInventoryItemId, category, name, quantity, unit, unitPrice, totalPrice, actualCost, notes, } = req.body;
        if (!milestoneId ||
            quantity === undefined ||
            (!supplierInventoryItemId && (!category || !name || !unit || unitPrice === undefined))) {
            return res.status(400).json({
                message: "milestoneId, quantity and either supplierInventoryItemId or category/name/unit/unitPrice are required",
            });
        }
        const milestone = await db_js_1.default.milestone.findUnique({
            where: { id: String(milestoneId) },
            include: {
                project: {
                    include: {
                        projectMembers: true,
                    },
                },
            },
        });
        if (!milestone) {
            return res.status(404).json({ message: "Milestone not found" });
        }
        if (!canManageBoq(milestone, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the milestone engineer or admin can create BOQ items",
            });
        }
        const inventoryItem = supplierInventoryItemId
            ? await db_js_1.default.supplierInventoryItem.findFirst({
                where: { id: String(supplierInventoryItemId), available: true },
            })
            : null;
        if (supplierInventoryItemId && !inventoryItem) {
            return res.status(400).json({ message: "Selected supplier inventory item is not available" });
        }
        const lockedCategory = inventoryItem?.category || String(category);
        const lockedName = inventoryItem?.name || String(name);
        const lockedUnit = inventoryItem?.unit || String(unit);
        const lockedUnitPrice = inventoryItem?.unitPrice ?? unitPrice;
        const boqItem = await db_js_1.default.boqItem.create({
            data: {
                milestoneId: milestone.id,
                supplierInventoryItemId: inventoryItem?.id,
                category: lockedCategory,
                name: lockedName,
                quantity: String(quantity),
                unit: lockedUnit,
                unitPrice: String(lockedUnitPrice),
                totalPrice: String(totalPrice ?? calculateTotalPrice(quantity, lockedUnitPrice)),
                actualCost: actualCost !== undefined ? String(actualCost) : undefined,
                notes,
            },
            include: {
                supplierInventoryItem: {
                    include: {
                        supplier: {
                            select: { id: true, name: true, email: true, image: true, role: true },
                        },
                    },
                },
                milestone: {
                    include: {
                        project: true,
                    },
                },
            },
        });
        return res.status(201).json({
            message: "BOQ item created successfully",
            boqItem,
        });
    }
    catch (error) {
        console.error("Create BOQ item error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createBoqItem = createBoqItem;
const getBoqItems = async (req, res) => {
    try {
        const milestoneId = typeof req.query.milestoneId === "string"
            ? req.query.milestoneId
            : undefined;
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const boqItems = await db_js_1.default.boqItem.findMany({
            where: {
                ...(milestoneId ? { milestoneId } : {}),
                ...(projectId ? { milestone: { projectId } } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : {
                        milestone: {
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
                        },
                    }),
            },
            include: {
                supplierInventoryItem: {
                    include: {
                        supplier: {
                            select: { id: true, name: true, email: true, image: true, role: true },
                        },
                    },
                },
                milestone: {
                    include: {
                        project: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json(boqItems);
    }
    catch (error) {
        console.error("Get BOQ items error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getBoqItems = getBoqItems;
const getBoqItemById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "BOQ item ID is required" });
        }
        const boqItem = await db_js_1.default.boqItem.findUnique({
            where: { id },
            include: {
                supplierInventoryItem: {
                    include: {
                        supplier: {
                            select: { id: true, name: true, email: true, image: true, role: true },
                        },
                    },
                },
                milestone: {
                    include: {
                        project: {
                            include: {
                                projectMembers: true,
                            },
                        },
                    },
                },
            },
        });
        if (!boqItem) {
            return res.status(404).json({ message: "BOQ item not found" });
        }
        if (!canReadProject(boqItem.milestone.project, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(boqItem);
    }
    catch (error) {
        console.error("Get BOQ item by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getBoqItemById = getBoqItemById;
const updateBoqItem = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "BOQ item ID is required" });
        }
        const existingBoqItem = await db_js_1.default.boqItem.findUnique({
            where: { id },
            include: {
                milestone: true,
            },
        });
        if (!existingBoqItem) {
            return res.status(404).json({ message: "BOQ item not found" });
        }
        if (!canManageBoq(existingBoqItem.milestone, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the milestone engineer or admin can update BOQ items",
            });
        }
        const boqItem = await db_js_1.default.boqItem.update({
            where: { id },
            data: buildBoqUpdateData(req.body, existingBoqItem),
            include: {
                supplierInventoryItem: {
                    include: {
                        supplier: {
                            select: { id: true, name: true, email: true, image: true, role: true },
                        },
                    },
                },
                milestone: {
                    include: {
                        project: true,
                    },
                },
            },
        });
        return res.json({
            message: "BOQ item updated successfully",
            boqItem,
        });
    }
    catch (error) {
        console.error("Update BOQ item error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateBoqItem = updateBoqItem;
const deleteBoqItem = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "BOQ item ID is required" });
        }
        const boqItem = await db_js_1.default.boqItem.findUnique({
            where: { id },
            include: {
                milestone: true,
            },
        });
        if (!boqItem) {
            return res.status(404).json({ message: "BOQ item not found" });
        }
        if (!canManageBoq(boqItem.milestone, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the milestone engineer or admin can delete BOQ items",
            });
        }
        await db_js_1.default.boqItem.delete({
            where: { id },
        });
        return res.json({ message: "BOQ item deleted successfully" });
    }
    catch (error) {
        console.error("Delete BOQ item error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteBoqItem = deleteBoqItem;
