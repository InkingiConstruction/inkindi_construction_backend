"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, text, html }) => {
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured");
    }
    const { data, error } = await resend.emails.send({
        to,
        from: `InkingiPro <${from}>`,
        subject,
        text,
        html,
    });
    if (error) {
        console.error("Resend email error:", error);
        throw new Error(error.message || "Failed to send email");
    }
    return data;
};
exports.default = sendEmail;
