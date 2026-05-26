import { Router } from "express";
import {
  uploadDocument,
  getKycStatus,
  getPendingKyc,
  approveKyc,
  rejectKyc,
} from "./kyc.controller.js";
import { requiredAuth } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/role.middleware.js";
import { uploadImages } from "../middleware/upload.middleware.js";

const router = Router();

router.post("/documents", requiredAuth, uploadImages, uploadDocument);
router.get("/status", requiredAuth, getKycStatus);

router.get("/pending", requiredAuth, isAdmin, getPendingKyc);
router.post("/:userId/approve", requiredAuth, isAdmin, approveKyc);
router.post("/:userId/reject", requiredAuth, isAdmin, rejectKyc);

export default router;
