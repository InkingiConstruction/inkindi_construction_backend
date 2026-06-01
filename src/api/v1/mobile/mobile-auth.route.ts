import { Router } from "express";
import {
  getMobileMe,
  loginMobileUser,
  registerMobileUser,
  verifyMobileEmail,
} from "./mobile-auth.controller.js";
import { requiredAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", registerMobileUser);
router.post("/login", loginMobileUser);
router.post("/verify-email", verifyMobileEmail);
router.get("/me", requiredAuth, getMobileMe);

export default router;
