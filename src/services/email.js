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

const sendWithResend = async ({ to, subject, html }) => {
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

const sendWithBrevo = async ({ to, subject, html }) => {
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
  const activeProvider = getConfiguredProvider();

  if (activeProvider === EMAIL_PROVIDER_RESEND) {
    requireConfiguredProvider(activeProvider);
    return sendWithResend({ to: email, subject, html });
  }

  if (activeProvider === EMAIL_PROVIDER_BREVO) {
    requireConfiguredProvider(activeProvider);
    return sendWithBrevo({ to: email, subject, html });
  }

  if (activeProvider) {
    requireConfiguredProvider(activeProvider);
  }

  const resendWorked = await sendWithResend({ to: email, subject, html });

  if (resendWorked) {
    return true;
  }

  const brevoWorked = await sendWithBrevo({ to: email, subject, html });

  if (brevoWorked) {
    return true;
  }

  throw createEmailError(
    EMAIL_DELIVERY_CONFIG_ERROR,
    `No email provider is configured for OTP delivery. Add RESEND_API_KEY or BREVO_API_KEY and use a verified sender such as ${getDefaultFromEmail()}.`,
  );
};
