import { Request, Response } from "express";
import twilio from "twilio";

const normalizeWhatsAppNumber = (phoneNumber: string) => {
  const trimmed = phoneNumber.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
};

export const sendTwilioTestMessage = async (req: Request, res: Response) => {
  try {
    const to = String(req.body.to || "").trim();
    const channel = String(req.body.channel || "whatsapp").trim().toLowerCase();
    const body = String(
      req.body.body || "Inkingi Twilio test message. If you see this, Twilio is working.",
    );

    if (!to) {
      return res.status(400).json({ message: "to is required, for example +25078XXXXXXX" });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({
        message: "Twilio env is missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN",
      });
    }

    const client = twilio(accountSid, authToken);
    const isWhatsApp = channel === "whatsapp";
    const from = isWhatsApp
      ? process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"
      : process.env.TWILIO_FROM_NUMBER;

    if (!from) {
      return res.status(500).json({
        message: "TWILIO_FROM_NUMBER is required for SMS tests",
      });
    }

    const message = await client.messages.create({
      body,
      from,
      to: isWhatsApp ? normalizeWhatsAppNumber(to) : to,
    });

    return res.json({
      message: "Twilio test message queued",
      sid: message.sid,
      status: message.status,
      channel: isWhatsApp ? "whatsapp" : "sms",
      to,
    });
  } catch (error) {
    console.error("Twilio test send error:", error);
    return res.status(500).json({
      message: "Twilio test failed",
      error: error instanceof Error ? error.message : "Unknown Twilio error",
    });
  }
};
