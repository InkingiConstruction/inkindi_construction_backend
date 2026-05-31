"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, html }) => {
    try {
        await resend.emails.send({
            from: "InkingiPro <onboarding@resend.dev>",
            to,
            subject,
            html,
        });
        console.log("Email sent to:", to);
    }
    catch (error) {
        console.error("Email error:", error);
    }
};
exports.sendEmail = sendEmail;
