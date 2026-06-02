import { Router } from "express";
import { requiredAuth } from "../middleware/auth.middleware";
import { isAdmin } from "../middleware/role.middleware";
import { sendTwilioTestMessage } from "./twilio-test.controller";

const router = Router();

router.post("/send", requiredAuth, isAdmin, sendTwilioTestMessage);

export default router;
