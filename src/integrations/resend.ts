interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "InkingiPro";

    if (!apiKey) {
      console.error("Email error: BREVO_API_KEY is not configured");
      return;
    }

    if (!senderEmail) {
      console.error("Email error: BREVO_SENDER_EMAIL is not configured");
      return;
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
      }),
    });

    const responseText = await response.text();
    const responseBody = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
      console.error("Brevo email error:", {
        status: response.status,
        response: responseBody,
      });
      return;
    }

    console.log("Email sent to:", to);
  } catch (error) {
    console.error("Email error:", error);
  }
};
