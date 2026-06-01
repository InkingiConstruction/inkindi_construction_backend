import { Router } from "express";
import {
  changePassword,
  getMe,
  login,
  logout,
  register,
  requestPasswordReset,
  resendOtp,
  resetPassword,
  verifyEmail,
} from "./auth.controller.js";
import { requiredAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOtp);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/me", requiredAuth, getMe);
router.post("/change-password", requiredAuth, changePassword);
router.post("/logout", requiredAuth, logout);

export default router;
