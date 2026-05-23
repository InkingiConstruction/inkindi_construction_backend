const baseStyle = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background-color: #ffffff;
`;
const otpBoxStyle = `
  font-size: 36px;
  font-weight: bold;
  letter-spacing: 8px;
  color: #1a1a1a;
  background-color: #f5f5f5;
  padding: 16px 32px;
  border-radius: 8px;
  display: inline-block;
  margin: 24px 0;
`;
const footerStyle = `
  font-size: 12px;
  color: #888888;
  margin-top: 32px;
  border-top: 1px solid #eeeeee;
  padding-top: 16px;
`;
export const emailVerificationTemplate = (otp) => ({
    subject: "Verify your InkingiPro email",
    html: `
    <div style="${baseStyle}">
      <h2 style="color: #1a1a1a;">Verify your email address</h2>
      <p>Welcome to InkingiPro! Use the code below to verify your email address.</p>
      <div style="${otpBoxStyle}">${otp}</div>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
      <div style="${footerStyle}">
        <p>InkingiPro — Trusted Construction Management Platform</p>
      </div>
    </div>
  `,
    text: `Your InkingiPro email verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not create an account, ignore this email.`,
});
export const passwordResetTemplate = (otp) => ({
    subject: "Reset your InkingiPro password",
    html: `
    <div style="${baseStyle}">
      <h2 style="color: #1a1a1a;">Reset your password</h2>
      <p>We received a request to reset your InkingiPro password. Use the code below to proceed.</p>
      <div style="${otpBoxStyle}">${otp}</div>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p>If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
      <div style="${footerStyle}">
        <p>InkingiPro — Trusted Construction Management Platform</p>
      </div>
    </div>
  `,
    text: `Your InkingiPro password reset code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request a password reset, ignore this email.`,
});
export const signInOTPTemplate = (otp) => ({
    subject: "Your InkingiPro sign-in code",
    html: `
    <div style="${baseStyle}">
      <h2 style="color: #1a1a1a;">Your sign-in code</h2>
      <p>Use the code below to sign in to your InkingiPro account.</p>
      <div style="${otpBoxStyle}">${otp}</div>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p>If you did not attempt to sign in, please secure your account immediately by resetting your password.</p>
      <div style="${footerStyle}">
        <p>InkingiPro — Trusted Construction Management Platform</p>
      </div>
    </div>
  `,
    text: `Your InkingiPro sign-in code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not attempt to sign in, reset your password immediately.`,
});
export const kycApprovedTemplate = (name) => ({
    subject: "Your identity has been verified — InkingiPro",
    html: `
    <div style="${baseStyle}">
      <h2 style="color: #16a34a;">Identity Verified ✓</h2>
      <p>Hi ${name},</p>
      <p>Great news! Your identity documents have been reviewed and your InkingiPro account is now fully verified.</p>
      <p>You now have full access to the platform and can:</p>
      <ul>
        <li>Create and manage projects</li>
        <li>Fund your escrow account</li>
        <li>Invite engineers and supervisors</li>
      </ul>
      <a href="${process.env.FRONTEND_URL}" style="
        display: inline-block;
        margin-top: 16px;
        padding: 12px 24px;
        background-color: #16a34a;
        color: #ffffff;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">Open InkingiPro</a>
      <div style="${footerStyle}">
        <p>InkingiPro — Trusted Construction Management Platform</p>
      </div>
    </div>
  `,
    text: `Hi ${name},\n\nYour InkingiPro identity has been verified. You now have full access to the platform.\n\nVisit: ${process.env.FRONTEND_URL}`,
});
export const kycRejectedTemplate = (name, reason) => ({
    subject: "Action required — InkingiPro identity verification",
    html: `
    <div style="${baseStyle}">
      <h2 style="color: #dc2626;">Verification Unsuccessful</h2>
      <p>Hi ${name},</p>
      <p>Unfortunately, we were unable to verify your identity. Please review the reason below and re-submit your documents.</p>
      <div style="
        background-color: #fef2f2;
        border-left: 4px solid #dc2626;
        padding: 12px 16px;
        border-radius: 4px;
        margin: 16px 0;
        color: #1a1a1a;
      ">
        <strong>Reason:</strong> ${reason}
      </div>
      <p>To re-submit, open the InkingiPro app and go to your profile to upload new documents.</p>
      <a href="${process.env.FRONTEND_URL}" style="
        display: inline-block;
        margin-top: 16px;
        padding: 12px 24px;
        background-color: #dc2626;
        color: #ffffff;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">Re-submit Documents</a>
      <p style="margin-top: 16px;">If you have questions, contact our support team.</p>
      <div style="${footerStyle}">
        <p>InkingiPro — Trusted Construction Management Platform</p>
      </div>
    </div>
  `,
    text: `Hi ${name},\n\nYour InkingiPro identity verification was unsuccessful.\n\nReason: ${reason}\n\nPlease re-submit your documents via the app.\n\nVisit: ${process.env.FRONTEND_URL}`,
});
