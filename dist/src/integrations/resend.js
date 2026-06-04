"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.BREVO_SENDER_EMAIL;
        const senderName = process.env.BREVO_SENDER_NAME || "InkingiPro";
        if (!apiKey) {
            console.error("Email error: BREVO_API_KEY is not configured");
            return false;
        }
        if (!senderEmail) {
            console.error("Email error: BREVO_SENDER_EMAIL is not configured");
            return false;
        }
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                accept: "application/json",
                "api-key": apiKey,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                sender: {
                    name: senderName,
                    email: senderEmail,
                },
                to: [{ email: to }],
                subject,
                htmlContent: html,
                ...(text ? { textContent: text } : {}),
            }),
        });
        const responseText = await response.text();
        const responseBody = responseText ? JSON.parse(responseText) : null;
        if (!response.ok) {
            console.error("Brevo email error:", {
                status: response.status,
                response: responseBody,
            });
            return false;
        }
        console.log("Email sent to:", to);
        return true;
    }
    catch (error) {
        console.error("Email error:", error);
        return false;
    }
};
exports.sendEmail = sendEmail;
