import { Router } from "express";
import swaggerRoutes from "./docs/swagger.route";

import sessionRoutes from "./auth/session.route";
import verificationRoutes from "./auth/verification.route";
import apiKeyRoutes from "./auth/api-key.route";

import userRoutes from "./users/user.route";
import accountRoutes from "./users/account.route";

import kycRoutes from "./kyc/kyc.route";

import projectRoutes from "./projects/project.route";
import projectMemberRoutes from "./projects/project-member.route";
import progressPhotoRoutes from "./projects/progress-photo.route";

import milestoneRoutes from "./milestones/milestone.route";
import boqItemRoutes from "./milestones/boq-item.route";

import escrowAccountRoutes from "./escrow/escrow-account.route";
import transactionRoutes from "./transactions/transaction.route";

import rfqRoutes from "./rfqs/rfq.route";
import purchaseOrderRoutes from "./rfqs/purchase-order.route";
import quoteRoutes from "./quotes/quote.route";
import deliveryRoutes from "./deliveries/delivery.route";

import inspectionRoutes from "./inspections/inspection.route";

import disputeRoutes from "./disputes/dispute.route";
import disputeEvidenceRoutes from "./disputes/dispute-evidence.route";

import notificationRoutes from "./notifications/notification.route";
import messageRoutes from "./notifications/message.route";
import emailTemplateRoutes from "./notifications/email-template.route";

import systemSettingRoutes from "./admin/system-setting.route";
import auditLogRoutes from "./admin/audit-log.route";
import activityLogRoutes from "./admin/activity-log.route";

const router = Router();

router.use("/", swaggerRoutes);

router.use("/sessions", sessionRoutes);
router.use("/verifications", verificationRoutes);
router.use("/api-keys", apiKeyRoutes);

router.use("/users", userRoutes);
router.use("/accounts", accountRoutes);

router.use("/kyc", kycRoutes);

router.use("/projects", projectRoutes);
router.use("/project-members", projectMemberRoutes);
router.use("/progress-photos", progressPhotoRoutes);

router.use("/milestones", milestoneRoutes);
router.use("/boq-items", boqItemRoutes);

router.use("/escrow-accounts", escrowAccountRoutes);
router.use("/transactions", transactionRoutes);

router.use("/rfqs", rfqRoutes);
router.use("/quotes", quoteRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/deliveries", deliveryRoutes);

router.use("/inspections", inspectionRoutes);

router.use("/disputes", disputeRoutes);
router.use("/dispute-evidence", disputeEvidenceRoutes);

router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);
router.use("/email-templates", emailTemplateRoutes);

router.use("/audit-logs", auditLogRoutes);
router.use("/activity-logs", activityLogRoutes);
router.use("/system-settings", systemSettingRoutes);

export default router;
