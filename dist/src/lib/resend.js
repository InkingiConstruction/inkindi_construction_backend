"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, text, html }) => {
    await resend.emails.send({
        to,
        from: `InkingiPro <${process.env.EMAIL_FROM}>`,
        subject,
        text,
        html,
    });
};
exports.default = sendEmail;
