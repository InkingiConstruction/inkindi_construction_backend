"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInventoryItem = exports.updateInventoryItem = exports.getInventoryItems = exports.createInventoryItem = void 0;
const db_js_1 = __importDefault(require("../../../config/db.js"));
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const canManageInventoryItem = (item, userId, role) => role === "admin" || (role === "supplier" && item.supplierId === userId);
const createInventoryItem = async (req, res) => {
    try {
        const { category, name, unit, unitPrice, deliveryFee, available, notes } = req.body;
        if (!category || !name || !unit || unitPrice === undefined) {
            return res.status(400).json({
                message: "category, name, unit and unitPrice are required",
            });
        }
        const inventoryItem = await db_js_1.default.supplierInventoryItem.create({
            data: {
                supplierId: req.user.id,
                category: String(category),
                name: String(name),
                unit: String(unit),
                unitPrice: String(unitPrice),
                deliveryFee: deliveryFee !== undefined && deliveryFee !== "" ? String(deliveryFee) : undefined,
                available: available === undefined ? true : Boolean(available),
                notes: notes ? String(notes) : undefined,
            },
            include: {
                supplier: {
                    select: { id: true, name: true, email: true, image: true, role: true },
                },
            },
        });
        return res.status(201).json({
            message: "Inventory item created successfully",
            inventoryItem,
        });
    }
    catch (error) {
        console.error("Create supplier inventory item error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createInventoryItem = createInventoryItem;
const getInventoryItems = async (req, res) => {
    try {
        const supplierId = typeof req.query.supplierId === "string" ? req.query.supplierId : undefined;
        const category = typeof req.query.category === "string" ? req.query.category : undefined;
        const search = typeof req.query.search === "string" ? req.query.search : undefined;
        const includeUnavailable = req.query.includeUnavailable === "true";
        const inventoryItems = await db_js_1.default.supplierInventoryItem.findMany({
            where: {
                ...(supplierId ? { supplierId } : {}),
                ...(category ? { category } : {}),
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { category: { contains: search, mode: "insensitive" } },
                        ],
                    }
                    : {}),
                ...(req.user.role === "supplier" && !supplierId
                    ? { supplierId: req.user.id }
                    : {}),
                ...(includeUnavailable && req.user.role === "supplier"
                    ? {}
                    : { available: true }),
            },
            include: {
                supplier: {
                    select: { id: true, name: true, email: true, image: true, role: true },
                },
            },
            orderBy: [{ category: "asc" }, { name: "asc" }],
        });
        return res.json(inventoryItems);
    }
    catch (error) {
        console.error("Get supplier inventory items error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getInventoryItems = getInventoryItems;
const updateInventoryItem = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id)
            return res.status(400).json({ message: "Inventory item ID is required" });
        const existing = await db_js_1.default.supplierInventoryItem.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: "Inventory item not found" });
        if (!canManageInventoryItem(existing, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const { category, name, unit, unitPrice, deliveryFee, available, notes } = req.body;
        const inventoryItem = await db_js_1.default.supplierInventoryItem.update({
            where: { id },
            data: {
                ...(category !== undefined ? { category: String(category) } : {}),
                ...(name !== undefined ? { name: String(name) } : {}),
                ...(unit !== undefined ? { unit: String(unit) } : {}),
                ...(unitPrice !== undefined ? { unitPrice: String(unitPrice) } : {}),
                ...(deliveryFee !== undefined ? { deliveryFee: deliveryFee ? String(deliveryFee) : null } : {}),
                ...(available !== undefined ? { available: Boolean(available) } : {}),
                ...(notes !== undefined ? { notes: notes ? String(notes) : null } : {}),
            },
            include: {
                supplier: {
                    select: { id: true, name: true, email: true, image: true, role: true },
                },
            },
        });
        return res.json({ message: "Inventory item updated successfully", inventoryItem });
    }
    catch (error) {
        console.error("Update supplier inventory item error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateInventoryItem = updateInventoryItem;
const deleteInventoryItem = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id)
            return res.status(400).json({ message: "Inventory item ID is required" });
        const existing = await db_js_1.default.supplierInventoryItem.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: "Inventory item not found" });
        if (!canManageInventoryItem(existing, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await db_js_1.default.supplierInventoryItem.delete({ where: { id } });
        return res.json({ message: "Inventory item deleted successfully" });
    }
    catch (error) {
        console.error("Delete supplier inventory item error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.deleteInventoryItem = deleteInventoryItem;
