import { Router } from "express";
import { sendTwilioTestMessage } from "./twilio-test.controller";

const router = Router();

router.post("/send", sendTwilioTestMessage);

export default router;
