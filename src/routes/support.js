import express from "express";
import crypto from "crypto";
import {
  isEmailDeliveryConfigurationError,
  isEmailDeliveryRequestError,
  sendSupportRequestEmail,
} from "../services/email.js";

const router = express.Router();
const DEFAULT_SUPPORT_EMAIL =
  String(process.env.SUPPORT_EMAIL_ADDRESS || "lopez.kyle922@gmail.com")
    .trim()
    .toLowerCase() || "lopez.kyle922@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const buildTicketId = () =>
  `support-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

const formatTopicLabel = (topic) => {
  const normalizedTopic = normalizeText(topic).toLowerCase();

  if (!normalizedTopic) {
    return "General Support";
  }

  return normalizedTopic
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const trySendEmailFailureResponse = (res, error) => {
  if (isEmailDeliveryConfigurationError(error)) {
    res.status(503).json({
      success: false,
      message:
        "Support email delivery is not configured on the server yet. Verify the sending domain and email provider settings first.",
    });
    return true;
  }

  if (isEmailDeliveryRequestError(error)) {
    res.status(502).json({
      success: false,
      message:
        "Unable to send the support email right now. Please try again after checking the email provider configuration.",
    });
    return true;
  }

  return false;
};

router.post(["/", "/contact"], async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const topic = normalizeText(req.body?.topic);
    const message = normalizeText(req.body?.message);
    const submittedBy = normalizeText(req.body?.submittedBy) || "guest";

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required." });
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const ticket = {
      id: buildTicketId(),
      name,
      email,
      topic,
      topicLabel: formatTopicLabel(topic),
      message,
      submittedBy,
      recipient: DEFAULT_SUPPORT_EMAIL,
      createdAt: new Date().toISOString(),
    };

    await sendSupportRequestEmail(ticket);

    return res.status(201).json({
      success: true,
      data: {
        ticket,
      },
    });
  } catch (error) {
    if (trySendEmailFailureResponse(res, error)) {
      return;
    }

    console.error("Support request error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit the support request right now.",
    });
  }
});

export default router;
