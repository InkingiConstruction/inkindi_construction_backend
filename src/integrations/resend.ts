import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions) => {
  try {
    const { error } = await resend.emails.send({
      from: "InkingiPro <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    if (error) {
      console.error("Email error:", error);
      return;
    }
    console.log("Email sent to:", to);
  } catch (error) {
    console.error("Email error:", error);
  }
};
