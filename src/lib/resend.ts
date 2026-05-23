import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const sendEmail = async ({ to, subject, text, html }: EmailOptions) => {
  await resend.emails.send({
    to,
    from: `InkingiPro <${process.env.EMAIL_FROM}>`,
    subject,
    text,
    html,
  });
};

export default sendEmail;
