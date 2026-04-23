const SIGNUP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i;
const USERNAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getDefaultName = (email) => normalizeEmail(email).split("@")[0] || "Eventcinity user";

export const getDefaultUsername = (email) =>
  normalizeUsername(getDefaultName(email)) || "eventcinity-user";

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

export const getUsernameValidationError = (username) => {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return "Username is required.";
  }

  if (normalizedUsername.length < 3) {
    return "Username must be at least 3 characters long.";
  }

  if (normalizedUsername.length > 30) {
    return "Username can be at most 30 characters long.";
  }

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return "Use lowercase letters, numbers, and single hyphens only.";
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

const getBaseSerializedUser = (user) => ({
  id: String(user._id),
  name: user.name || getDefaultName(user.email),
  username: user.username || getDefaultUsername(user.email),
  avatar: user.avatar || "",
  profilePic: user.avatar || "",
  location: user.location || "Philippines",
  phone: user.phone || "",
  bio: user.bio || "",
  createdAt: user.createdAt,
});

export const serializePublicUser = (user, stats = {}) => ({
  ...getBaseSerializedUser(user),
  contact: user.phone || "",
  interests: normalizeInterestList(user.interests),
  createdEventsCount: Number(stats.createdEventsCount || 0),
  followersCount: Number(stats.followersCount ?? user.followers?.length ?? 0),
  followingCount: Number(stats.followingCount ?? user.following?.length ?? 0),
  isMock: Boolean(stats.isMock),
});

export const serializeUser = (user, stats = {}) => {
  const interests = normalizeInterestList(user.interests);
  const hasCompletedOnboarding = interests.length > 0;

  return {
    ...getBaseSerializedUser(user),
    email: user.email,
    provider: user.provider,
    phone: user.phone || "",
    interests,
    createdEventsCount: Number(stats.createdEventsCount || 0),
    followersCount: Number(stats.followersCount ?? user.followers?.length ?? 0),
    followingCount: Number(stats.followingCount ?? user.following?.length ?? 0),
    followerUsernames: Array.isArray(stats.followerUsernames)
      ? stats.followerUsernames.filter(Boolean)
      : [],
    followingUsernames: Array.isArray(stats.followingUsernames)
      ? stats.followingUsernames.filter(Boolean)
      : [],
    needsInterestsSelection: !hasCompletedOnboarding,
    hasCompletedOnboarding,
    isMock: Boolean(stats.isMock),
  };
};
