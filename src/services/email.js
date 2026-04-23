const EMAIL_PROVIDER_RESEND = "resend";
const EMAIL_PROVIDER_BREVO = "brevo";

const getVerificationEmailMarkup = ({ name, code }) => `
  <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f1a17;">
    <h2 style="margin: 0 0 12px;">Verify your Eventcinity account</h2>
    <p style="margin: 0 0 16px;">Hi ${name || "there"},</p>
    <p style="margin: 0 0 16px;">
      Use the verification code below to finish creating your Eventcinity account.
    </p>
    <div style="margin: 0 0 20px; padding: 14px 18px; border-radius: 12px; background: #f3eee6; font-size: 28px; font-weight: 700; letter-spacing: 0.18em; text-align: center;">
      ${code}
    </div>
    <p style="margin: 0; color: #6b655d;">
      This code expires in 15 minutes.
    </p>
  </div>
`;

const sendWithResend = async ({ to, subject, html }) => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromEmail = String(process.env.RESEND_FROM_EMAIL || "").trim();

  if (!apiKey || !fromEmail) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend email delivery failed: ${responseText}`);
  }

  return true;
};

const sendWithBrevo = async ({ to, subject, html }) => {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  const fromEmail = String(process.env.BREVO_FROM_EMAIL || "").trim();
  const fromName = String(process.env.BREVO_FROM_NAME || "Eventcinity").trim();

  if (!apiKey || !fromEmail) {
    return false;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: fromEmail,
        name: fromName,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Brevo email delivery failed: ${responseText}`);
  }

  return true;
};

export const sendVerificationEmail = async ({ email, name, code }) => {
  const subject = "Your Eventcinity verification code";
  const html = getVerificationEmailMarkup({ name, code });
  const activeProvider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();

  if (activeProvider === EMAIL_PROVIDER_RESEND) {
    return sendWithResend({ to: email, subject, html });
  }

  if (activeProvider === EMAIL_PROVIDER_BREVO) {
    return sendWithBrevo({ to: email, subject, html });
  }

  const resendWorked = await sendWithResend({ to: email, subject, html });

  if (resendWorked) {
    return true;
  }

  const brevoWorked = await sendWithBrevo({ to: email, subject, html });

  if (brevoWorked) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "Email delivery provider is not configured. Verification code available in server logs only.",
    );
    console.info(`Eventcinity verification code for ${email}: ${code}`);
    return true;
  }

  throw new Error("Email delivery provider is not configured.");
};
