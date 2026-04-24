const EMAIL_PROVIDER_RESEND = "resend";
const EMAIL_PROVIDER_BREVO = "brevo";
const EMAIL_DELIVERY_CONFIG_ERROR = "EMAIL_DELIVERY_CONFIG_ERROR";
const EMAIL_DELIVERY_REQUEST_ERROR = "EMAIL_DELIVERY_REQUEST_ERROR";

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

const getPasswordResetEmailMarkup = ({ name, code }) => `
  <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f1a17;">
    <h2 style="margin: 0 0 12px;">Reset your Eventcinity password</h2>
    <p style="margin: 0 0 16px;">Hi ${name || "there"},</p>
    <p style="margin: 0 0 16px;">
      Use the reset code below to create a new password for your Eventcinity account.
    </p>
    <div style="margin: 0 0 20px; padding: 14px 18px; border-radius: 12px; background: #f3eee6; font-size: 28px; font-weight: 700; letter-spacing: 0.18em; text-align: center;">
      ${code}
    </div>
    <p style="margin: 0; color: #6b655d;">
      This code expires in 15 minutes. If you did not request this, you can ignore this email.
    </p>
  </div>
`;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getSupportRequestEmailMarkup = ({
  id,
  name,
  email,
  topicLabel,
  message,
  submittedBy,
  createdAt,
}) => `
  <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f1a17;">
    <h2 style="margin: 0 0 12px;">New Eventcinity support request</h2>
    <p style="margin: 0 0 16px;">
      A new Contact Support submission was received.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
      <tbody>
        <tr>
          <td style="padding: 8px 0; font-weight: 700;">Ticket ID</td>
          <td style="padding: 8px 0;">${escapeHtml(id)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 700;">From</td>
          <td style="padding: 8px 0;">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 700;">Topic</td>
          <td style="padding: 8px 0;">${escapeHtml(topicLabel || "General Support")}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 700;">Submitted By</td>
          <td style="padding: 8px 0;">${escapeHtml(submittedBy || "guest")}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 700;">Submitted At</td>
          <td style="padding: 8px 0;">${escapeHtml(createdAt || "")}</td>
        </tr>
      </tbody>
    </table>
    <div style="padding: 16px 18px; border-radius: 12px; background: #f3eee6; white-space: pre-wrap; line-height: 1.6;">
      ${escapeHtml(message)}
    </div>
  </div>
`;

const createEmailError = (code, message, cause = null) => {
  const error = new Error(message);
  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
};

const getConfiguredClientOrigin = () =>
  [
    process.env.CLIENT_URL,
    ...(process.env.CLIENT_URLS || "").split(","),
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);

const getBaseEmailDomain = () => {
  const explicitDomain = String(process.env.EMAIL_FROM_DOMAIN || "").trim();

  if (explicitDomain) {
    return explicitDomain.replace(/^@+/, "").toLowerCase();
  }

  const configuredOrigin = getConfiguredClientOrigin();

  if (configuredOrigin) {
    try {
      const hostname = new URL(configuredOrigin).hostname.toLowerCase();

      if (hostname.startsWith("www.")) {
        return hostname.slice(4);
      }

      if (hostname.startsWith("api.")) {
        return hostname.slice(4);
      }

      return hostname;
    } catch {
      // Ignore malformed URLs and use the default domain instead.
    }
  }

  return "eventcinity.com";
};

const getDefaultFromEmail = () => `noreply@${getBaseEmailDomain()}`;
const getDefaultFromName = () =>
  String(process.env.EMAIL_FROM_NAME || "Eventcinity").trim() || "Eventcinity";

const getSenderIdentity = () => ({
  email:
    String(process.env.EMAIL_FROM_ADDRESS || "").trim().toLowerCase() ||
    getDefaultFromEmail(),
  name: getDefaultFromName(),
});

const getConfiguredProvider = () =>
  String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();

const getResendConfig = () => {
  const sender = getSenderIdentity();

  return {
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    fromEmail:
      String(process.env.RESEND_FROM_EMAIL || "").trim().toLowerCase() ||
      sender.email,
    fromName:
      String(process.env.RESEND_FROM_NAME || "").trim() ||
      sender.name,
  };
};

const getBrevoConfig = () => {
  const sender = getSenderIdentity();

  return {
    apiKey: String(process.env.BREVO_API_KEY || "").trim(),
    fromEmail:
      String(process.env.BREVO_FROM_EMAIL || "").trim().toLowerCase() ||
      sender.email,
    fromName:
      String(process.env.BREVO_FROM_NAME || "").trim() ||
      sender.name,
  };
};

const sendWithResend = async ({ to, subject, html, text = "", replyTo = "" }) => {
  const { apiKey, fromEmail, fromName } = getResendConfig();

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
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw createEmailError(
      EMAIL_DELIVERY_REQUEST_ERROR,
      `Resend email delivery failed: ${responseText}`,
    );
  }

  return true;
};

const sendWithBrevo = async ({ to, subject, html, text = "", replyTo = "" }) => {
  const { apiKey, fromEmail, fromName } = getBrevoConfig();

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
      textContent: text,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw createEmailError(
      EMAIL_DELIVERY_REQUEST_ERROR,
      `Brevo email delivery failed: ${responseText}`,
    );
  }

  return true;
};

const requireConfiguredProvider = (provider) => {
  if (provider === EMAIL_PROVIDER_RESEND) {
    const { apiKey } = getResendConfig();

    if (!apiKey) {
      throw createEmailError(
        EMAIL_DELIVERY_CONFIG_ERROR,
        "EMAIL_PROVIDER is set to resend, but RESEND_API_KEY is missing.",
      );
    }

    return;
  }

  if (provider === EMAIL_PROVIDER_BREVO) {
    const { apiKey } = getBrevoConfig();

    if (!apiKey) {
      throw createEmailError(
        EMAIL_DELIVERY_CONFIG_ERROR,
        "EMAIL_PROVIDER is set to brevo, but BREVO_API_KEY is missing.",
      );
    }

    return;
  }

  throw createEmailError(
    EMAIL_DELIVERY_CONFIG_ERROR,
    `Unsupported EMAIL_PROVIDER value "${provider}". Use "resend" or "brevo".`,
  );
};

export const isEmailDeliveryConfigurationError = (error) =>
  error?.code === EMAIL_DELIVERY_CONFIG_ERROR;

export const isEmailDeliveryRequestError = (error) =>
  error?.code === EMAIL_DELIVERY_REQUEST_ERROR;

export const sendVerificationEmail = async ({ email, name, code }) => {
  const subject = "Your Eventcinity verification code";
  const html = getVerificationEmailMarkup({ name, code });
  return sendAuthCodeEmail({ email, subject, html });
};

export const sendPasswordResetEmail = async ({ email, name, code }) => {
  const subject = "Your Eventcinity password reset code";
  const html = getPasswordResetEmailMarkup({ name, code });
  return sendAuthCodeEmail({ email, subject, html });
};

const sendAuthCodeEmail = async ({ email, subject, html }) => {
  return sendTransactionalEmail({ to: email, subject, html });
};

export const sendSupportRequestEmail = async ({
  id,
  name,
  email,
  topicLabel,
  message,
  submittedBy,
  createdAt,
  recipient = String(process.env.SUPPORT_EMAIL_ADDRESS || "lopez.kyle922@gmail.com")
    .trim()
    .toLowerCase(),
}) => {
  const safeRecipient = recipient || "lopez.kyle922@gmail.com";
  const safeTopicLabel = String(topicLabel || "General Support").trim() || "General Support";
  const subject = `[Support] ${safeTopicLabel} (${id})`;
  const html = getSupportRequestEmailMarkup({
    id,
    name,
    email,
    topicLabel: safeTopicLabel,
    message,
    submittedBy,
    createdAt,
  });
  const text = [
    "New Eventcinity support request",
    `Ticket ID: ${id}`,
    `From: ${name} <${email}>`,
    `Topic: ${safeTopicLabel}`,
    `Submitted By: ${submittedBy || "guest"}`,
    `Submitted At: ${createdAt || ""}`,
    "",
    message,
  ].join("\n");

  return sendTransactionalEmail({
    to: safeRecipient,
    subject,
    html,
    text,
    replyTo: email,
  });
};

const sendTransactionalEmail = async ({
  to,
  subject,
  html,
  text = "",
  replyTo = "",
}) => {
  const activeProvider = getConfiguredProvider();

  if (activeProvider === EMAIL_PROVIDER_RESEND) {
    requireConfiguredProvider(activeProvider);
    return sendWithResend({ to, subject, html, text, replyTo });
  }

  if (activeProvider === EMAIL_PROVIDER_BREVO) {
    requireConfiguredProvider(activeProvider);
    return sendWithBrevo({ to, subject, html, text, replyTo });
  }

  if (activeProvider) {
    requireConfiguredProvider(activeProvider);
  }

  const resendWorked = await sendWithResend({
    to,
    subject,
    html,
    text,
    replyTo,
  });

  if (resendWorked) {
    return true;
  }

  const brevoWorked = await sendWithBrevo({
    to,
    subject,
    html,
    text,
    replyTo,
  });

  if (brevoWorked) {
    return true;
  }

  throw createEmailError(
    EMAIL_DELIVERY_CONFIG_ERROR,
    `No email provider is configured for OTP delivery. Add RESEND_API_KEY or BREVO_API_KEY and use a verified sender such as ${getDefaultFromEmail()}.`,
  );
};
