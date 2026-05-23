import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import kycRoutes from "./routes/kyc.route";
import userRoutes from "./routes/user.route";
import sessionRoutes from "./routes/session.route";
import accountRoutes from "./routes/account.route";
import verificationRoutes from "./routes/verification.route";
import projectRoutes from "./routes/project.route";
import projectMemberRoutes from "./routes/project-member.route";
import escrowAccountRoutes from "./routes/escrow-account.route";
import transactionRoutes from "./routes/transaction.route";
import milestoneRoutes from "./routes/milestone.route";
import boqItemRoutes from "./routes/boq-item.route";
import rfqRoutes from "./routes/rfq.route";
import quoteRoutes from "./routes/quote.route";
import purchaseOrderRoutes from "./routes/purchase-order.route";
import deliveryRoutes from "./routes/delivery.route";
import progressPhotoRoutes from "./routes/progress-photo.route";
import inspectionRoutes from "./routes/inspection.route";
import disputeRoutes from "./routes/dispute.route";
import disputeEvidenceRoutes from "./routes/dispute-evidence.route";
import messageRoutes from "./routes/message.route";
import notificationRoutes from "./routes/notification.route";
import auditLogRoutes from "./routes/audit-log.route";
import activityLogRoutes from "./routes/activity-log.route";
import apiKeyRoutes from "./routes/api-key.route";
import systemSettingRoutes from "./routes/system-setting.route";
import emailTemplateRoutes from "./routes/email-template.route";
const app = express();
const port = process.env.PORT;
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:5173"];
app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());
app.get("/", (_req, res) => {
    res.send("Inkingi API is Live! 🚀");
});
app.use("/api/kyc", kycRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/verifications", verificationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/project-members", projectMemberRoutes);
app.use("/api/escrow-accounts", escrowAccountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/boq-items", boqItemRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/progress-photos", progressPhotoRoutes);
app.use("/api/inspections", inspectionRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/dispute-evidence", disputeEvidenceRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/api-keys", apiKeyRoutes);
app.use("/api/system-settings", systemSettingRoutes);
app.use("/api/email-templates", emailTemplateRoutes);
app.listen(Number(port), "0.0.0.0", () => {
    console.log("Server is running at http://0.0.0.0:" + port);
});
