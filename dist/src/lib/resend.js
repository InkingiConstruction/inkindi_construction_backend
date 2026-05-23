import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, text, html }) => {
    await resend.emails.send({
        to,
        from: `InkingiPro <${process.env.EMAIL_FROM}>`,
        subject,
        text,
        html,
    });
};
export default sendEmail;
