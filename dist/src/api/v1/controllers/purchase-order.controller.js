import { PurchaseOrderStatus } from "@prisma/client";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.js";
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const isPurchaseOrderStatus = (value) => typeof value === "string" &&
    Object.values(PurchaseOrderStatus).includes(value);
const uploadImage = (file, folder) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
        folder,
        resource_type: "image",
    }, (error, result) => {
        if (error || !result) {
            reject(error);
            return;
        }
        resolve(result);
    });
    stream.end(file.buffer);
});
const canReadPurchaseOrder = (purchaseOrder, userId, role) => {
    if (role === "admin")
        return true;
    if (role === "supplier")
        return purchaseOrder.supplierId === userId;
    if (purchaseOrder.rfq.engineerId === userId)
        return true;
    if (purchaseOrder.rfq.project.clientId === userId)
        return true;
    if (purchaseOrder.rfq.project.engineerId === userId)
        return true;
    return Boolean(purchaseOrder.rfq.project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const canCreatePurchaseOrder = (quote, userId, role) => role === "admin" || (role === "engineer" && quote.rfq.engineerId === userId);
const generatePoNumber = () => `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
export const createPurchaseOrder = async (req, res) => {
    try {
        const { quoteId, poNumber, cloudinaryUrl, status } = req.body;
        const files = req.files || [];
        if (!quoteId) {
            return res.status(400).json({ message: "quoteId is required" });
        }
        if (status !== undefined && !isPurchaseOrderStatus(status)) {
            return res.status(400).json({ message: "Invalid purchase order status" });
        }
        const quote = await prisma.quote.findUnique({
            where: { id: String(quoteId) },
            include: {
                rfq: {
                    include: {
                        purchaseOrder: true,
                    },
                },
                purchaseOrder: true,
            },
        });
        if (!quote) {
            return res.status(404).json({ message: "Quote not found" });
        }
        if (!canCreatePurchaseOrder(quote, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the RFQ engineer or admin can create a purchase order",
            });
        }
        if (quote.status !== "selected") {
            return res.status(400).json({
                message: "Only selected quotes can become purchase orders",
                currentStatus: quote.status,
            });
        }
        if (quote.purchaseOrder || quote.rfq.purchaseOrder) {
            return res.status(409).json({
                message: "This RFQ or quote already has a purchase order",
            });
        }
        const upload = files[0]
            ? await uploadImage(files[0], "inkingi/procurement/purchase-orders")
            : null;
        const nextCloudinaryUrl = upload?.secure_url || cloudinaryUrl;
        if (!nextCloudinaryUrl) {
            return res.status(400).json({
                message: "cloudinaryUrl or purchase order file is required",
            });
        }
        const purchaseOrder = await prisma.$transaction(async (tx) => {
            const createdPurchaseOrder = await tx.purchaseOrder.create({
                data: {
                    rfqId: quote.rfqId,
                    quoteId: quote.id,
                    supplierId: quote.supplierId,
                    poNumber: poNumber || generatePoNumber(),
                    cloudinaryUrl: nextCloudinaryUrl,
                    status: status || "issued",
                },
                include: {
                    rfq: {
                        include: {
                            project: true,
                            milestone: true,
                        },
                    },
                    quote: true,
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                            role: true,
                        },
                    },
                    deliveries: true,
                },
            });
            await tx.rfq.update({
                where: { id: quote.rfqId },
                data: { status: "closed" },
            });
            return createdPurchaseOrder;
        });
        return res.status(201).json({
            message: "Purchase order created successfully",
            purchaseOrder,
        });
    }
    catch (error) {
        console.error("Create purchase order error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getPurchaseOrders = async (req, res) => {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const supplierId = typeof req.query.supplierId === "string"
            ? req.query.supplierId
            : undefined;
        const rfqId = typeof req.query.rfqId === "string" ? req.query.rfqId : undefined;
        if (status !== undefined && !isPurchaseOrderStatus(status)) {
            return res.status(400).json({ message: "Invalid purchase order status" });
        }
        const purchaseOrders = await prisma.purchaseOrder.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(supplierId ? { supplierId } : {}),
                ...(rfqId ? { rfqId } : {}),
                ...(req.user.role === "supplier"
                    ? { supplierId: req.user.id }
                    : req.user.role === "admin"
                        ? {}
                        : {
                            rfq: {
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
                rfq: {
                    include: {
                        project: true,
                        milestone: true,
                    },
                },
                quote: true,
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                deliveries: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(purchaseOrders);
    }
    catch (error) {
        console.error("Get purchase orders error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getPurchaseOrderById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Purchase order ID is required" });
        }
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                rfq: {
                    include: {
                        project: {
                            include: {
                                projectMembers: true,
                            },
                        },
                        milestone: true,
                    },
                },
                quote: true,
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                deliveries: true,
            },
        });
        if (!purchaseOrder) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        if (!canReadPurchaseOrder(purchaseOrder, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(purchaseOrder);
    }
    catch (error) {
        console.error("Get purchase order by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const updatePurchaseOrder = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { poNumber, cloudinaryUrl, status } = req.body;
        const files = req.files || [];
        if (!id) {
            return res.status(400).json({ message: "Purchase order ID is required" });
        }
        if (status !== undefined && !isPurchaseOrderStatus(status)) {
            return res.status(400).json({ message: "Invalid purchase order status" });
        }
        const existingPurchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                rfq: true,
            },
        });
        if (!existingPurchaseOrder) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        const supplierAccepting = req.user.role === "supplier" &&
            existingPurchaseOrder.supplierId === req.user.id &&
            status === "accepted";
        const engineerUpdating = req.user.role === "admin" ||
            (req.user.role === "engineer" &&
                existingPurchaseOrder.rfq.engineerId === req.user.id);
        if (!supplierAccepting && !engineerUpdating) {
            return res.status(403).json({
                message: "Only supplier can accept, and RFQ engineer or admin can update purchase order",
            });
        }
        const upload = files[0]
            ? await uploadImage(files[0], "inkingi/procurement/purchase-orders")
            : null;
        const purchaseOrder = await prisma.purchaseOrder.update({
            where: { id },
            data: {
                poNumber: engineerUpdating ? poNumber : undefined,
                cloudinaryUrl: engineerUpdating && upload
                    ? upload.secure_url
                    : engineerUpdating
                        ? cloudinaryUrl
                        : undefined,
                status,
                acceptedAt: status === "accepted" ? new Date() : undefined,
                completedAt: status === "completed" ? new Date() : undefined,
            },
            include: {
                rfq: {
                    include: {
                        project: true,
                        milestone: true,
                    },
                },
                quote: true,
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                deliveries: true,
            },
        });
        return res.json({
            message: "Purchase order updated successfully",
            purchaseOrder,
        });
    }
    catch (error) {
        console.error("Update purchase order error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const deletePurchaseOrder = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Purchase order ID is required" });
        }
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                deliveries: true,
            },
        });
        if (!purchaseOrder) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        if (purchaseOrder.deliveries.length > 0) {
            return res.status(400).json({
                message: "Purchase order with deliveries cannot be deleted",
            });
        }
        await prisma.purchaseOrder.delete({
            where: { id },
        });
        return res.json({ message: "Purchase order deleted successfully" });
    }
    catch (error) {
        console.error("Delete purchase order error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
