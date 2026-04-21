const SIGNUP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i;

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const getDefaultName = (email) => normalizeEmail(email).split("@")[0] || "Eventcinity user";

export const getDefaultUsername = (email) =>
  getDefaultName(email)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

export const getSignupEmailError = (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "Email is required.";
  }

  if (!SIGNUP_EMAIL_PATTERN.test(normalizedEmail)) {
    return "Use a valid email address that includes @ and ends in .com.";
  }

  return "";
};

export const normalizeInterestList = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        return value.trim();
      }

      if (value && typeof value === "object") {
        return String(value.label || value.name || value.title || "").trim();
      }

      return "";
    })
    .filter(Boolean);
};

export const serializeUser = (user) => {
  const interests = normalizeInterestList(user.interests);
  const hasCompletedOnboarding = interests.length > 0;

  return {
    id: String(user._id),
    name: user.name || getDefaultName(user.email),
    username: user.username || getDefaultUsername(user.email),
    email: user.email,
    provider: user.provider,
    avatar: user.avatar || "",
    profilePic: user.avatar || "",
    phone: user.phone || "",
    bio: user.bio || "",
    interests,
    createdAt: user.createdAt,
    needsInterestsSelection: !hasCompletedOnboarding,
    hasCompletedOnboarding,
  };
};
