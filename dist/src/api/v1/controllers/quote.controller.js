import { Prisma, QuoteStatus } from "@prisma/client";
import cloudinary from "../../../lib/cloudinary.js";
import prisma from "../../../lib/prisma.js";
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const parseJsonField = (value) => {
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
const isQuoteStatus = (value) => typeof value === "string" &&
    Object.values(QuoteStatus).includes(value);
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
const getUploadedCerts = (files) => Promise.all(files.map((file) => uploadImage(file, "inkingi/procurement/quote-certs")));
const canReadQuote = (quote, userId, role) => {
    if (role === "admin")
        return true;
    if (role === "supplier")
        return quote.supplierId === userId;
    if (quote.rfq.engineerId === userId)
        return true;
    if (quote.rfq.project.clientId === userId)
        return true;
    if (quote.rfq.project.engineerId === userId)
        return true;
    return Boolean(quote.rfq.project.projectMembers?.some((member) => member.userId === userId && member.status === "accepted"));
};
const canSelectQuote = (quote, userId, role) => role === "admin" || (role === "engineer" && quote.rfq.engineerId === userId);
export const createQuote = async (req, res) => {
    try {
        const { rfqId, unitPrice, totalPrice, deliveryDays, warrantyMonths, terms, certUrls, } = req.body;
        const files = req.files || [];
        if (!rfqId || !unitPrice || !deliveryDays) {
            return res.status(400).json({
                message: "rfqId, unitPrice and deliveryDays are required",
            });
        }
        const rfq = await prisma.rfq.findUnique({
            where: { id: String(rfqId) },
            include: {
                quotes: {
                    where: { supplierId: req.user.id },
                },
            },
        });
        if (!rfq) {
            return res.status(404).json({ message: "RFQ not found" });
        }
        if (rfq.status !== "open") {
            return res.status(400).json({
                message: "Supplier can only quote on open RFQs",
                currentStatus: rfq.status,
            });
        }
        if (rfq.deadline < new Date()) {
            return res.status(400).json({ message: "RFQ deadline has passed" });
        }
        if (rfq.quotes.length > 0) {
            return res.status(409).json({
                message: "You have already submitted a quote for this RFQ",
            });
        }
        const uploads = await getUploadedCerts(files);
        const uploadedCertUrls = uploads.map((upload) => ({
            cloudinaryUrl: upload.secure_url,
            publicId: upload.public_id,
        }));
        const bodyCertUrls = parseJsonField(certUrls);
        const nextTotalPrice = totalPrice !== undefined
            ? new Prisma.Decimal(totalPrice)
            : new Prisma.Decimal(unitPrice).times(rfq.quantity);
        const quote = await prisma.quote.create({
            data: {
                rfqId: rfq.id,
                supplierId: req.user.id,
                unitPrice: new Prisma.Decimal(unitPrice),
                totalPrice: nextTotalPrice,
                deliveryDays: Number(deliveryDays),
                warrantyMonths: warrantyMonths !== undefined ? Number(warrantyMonths) : undefined,
                terms,
                certUrls: uploadedCertUrls.length > 0
                    ? uploadedCertUrls
                    : bodyCertUrls || [],
            },
            include: {
                rfq: {
                    include: {
                        project: true,
                        milestone: true,
                    },
                },
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
            },
        });
        return res.status(201).json({
            message: "Quote submitted successfully",
            quote,
        });
    }
    catch (error) {
        console.error("Create quote error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getQuotes = async (req, res) => {
    try {
        const rfqId = typeof req.query.rfqId === "string" ? req.query.rfqId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        if (status !== undefined && !isQuoteStatus(status)) {
            return res.status(400).json({ message: "Invalid quote status" });
        }
        const quotes = await prisma.quote.findMany({
            where: {
                ...(rfqId ? { rfqId } : {}),
                ...(status ? { status } : {}),
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
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                purchaseOrder: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(quotes);
    }
    catch (error) {
        console.error("Get quotes error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getQuoteById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Quote ID is required" });
        }
        const quote = await prisma.quote.findUnique({
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
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
                purchaseOrder: true,
            },
        });
        if (!quote) {
            return res.status(404).json({ message: "Quote not found" });
        }
        if (!canReadQuote(quote, req.user.id, req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(quote);
    }
    catch (error) {
        console.error("Get quote by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const updateQuote = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { unitPrice, totalPrice, deliveryDays, warrantyMonths, terms, certUrls, status, } = req.body;
        const files = req.files || [];
        if (!id) {
            return res.status(400).json({ message: "Quote ID is required" });
        }
        if (status !== undefined && !isQuoteStatus(status)) {
            return res.status(400).json({ message: "Invalid quote status" });
        }
        const existingQuote = await prisma.quote.findUnique({
            where: { id },
            include: {
                rfq: true,
                purchaseOrder: true,
            },
        });
        if (!existingQuote) {
            return res.status(404).json({ message: "Quote not found" });
        }
        if (existingQuote.purchaseOrder) {
            return res.status(400).json({
                message: "Quote with purchase order cannot be updated",
            });
        }
        const supplierEditing = req.user.role === "supplier" && existingQuote.supplierId === req.user.id;
        const selectorEditing = status !== undefined && canSelectQuote(existingQuote, req.user.id, req.user.role);
        if (!supplierEditing && !selectorEditing) {
            return res.status(403).json({
                message: "Only the quote supplier can update quote details, and RFQ engineer or admin can update quote status",
            });
        }
        if (supplierEditing && existingQuote.status !== "pending_selection") {
            return res.status(400).json({
                message: "Supplier can only edit quotes before selection",
            });
        }
        const uploads = await getUploadedCerts(files);
        const uploadedCertUrls = uploads.map((upload) => ({
            cloudinaryUrl: upload.secure_url,
            publicId: upload.public_id,
        }));
        const quote = await prisma.$transaction(async (tx) => {
            if (status === "selected") {
                await tx.quote.updateMany({
                    where: {
                        rfqId: existingQuote.rfqId,
                        id: { not: existingQuote.id },
                    },
                    data: {
                        status: "rejected",
                    },
                });
            }
            return tx.quote.update({
                where: { id },
                data: {
                    unitPrice: supplierEditing && unitPrice !== undefined
                        ? new Prisma.Decimal(unitPrice)
                        : undefined,
                    totalPrice: supplierEditing && totalPrice !== undefined
                        ? new Prisma.Decimal(totalPrice)
                        : supplierEditing && unitPrice !== undefined
                            ? new Prisma.Decimal(unitPrice).times(existingQuote.rfq.quantity)
                            : undefined,
                    deliveryDays: supplierEditing && deliveryDays !== undefined
                        ? Number(deliveryDays)
                        : undefined,
                    warrantyMonths: supplierEditing && warrantyMonths !== undefined
                        ? Number(warrantyMonths)
                        : undefined,
                    terms: supplierEditing ? terms : undefined,
                    certUrls: supplierEditing && uploadedCertUrls.length > 0
                        ? uploadedCertUrls
                        : supplierEditing && certUrls !== undefined
                            ? parseJsonField(certUrls)
                            : undefined,
                    status,
                    selectedAt: status === "selected" ? new Date() : undefined,
                },
                include: {
                    rfq: {
                        include: {
                            project: true,
                            milestone: true,
                        },
                    },
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                            role: true,
                        },
                    },
                    purchaseOrder: true,
                },
            });
        });
        return res.json({
            message: "Quote updated successfully",
            quote,
        });
    }
    catch (error) {
        console.error("Update quote error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const deleteQuote = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Quote ID is required" });
        }
        const quote = await prisma.quote.findUnique({
            where: { id },
            include: {
                purchaseOrder: true,
            },
        });
        if (!quote) {
            return res.status(404).json({ message: "Quote not found" });
        }
        if (req.user.role !== "admin" && quote.supplierId !== req.user.id) {
            return res.status(403).json({
                message: "Only the quote supplier or admin can delete this quote",
            });
        }
        if (quote.purchaseOrder || quote.status === "selected") {
            return res.status(400).json({
                message: "Selected quote or quote with purchase order cannot be deleted",
            });
        }
        await prisma.quote.delete({
            where: { id },
        });
        return res.json({ message: "Quote deleted successfully" });
    }
    catch (error) {
        console.error("Delete quote error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
