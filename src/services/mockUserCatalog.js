import User from "../models/User.js";
import { mockUsers } from "../data/mockUsers.js";
import { hashPassword } from "../utils/password.js";

let seedPromise = null;

const buildMockPassword = (username) =>
  hashPassword(`mock-account-disabled:${String(username || "").trim().toLowerCase()}`);

const normalizeMockUserRecord = (user) => ({
  email: String(user.email || "").trim().toLowerCase(),
  name: String(user.name || "").trim(),
  username: String(user.username || "").trim().toLowerCase(),
  provider: "local",
  source: "mock",
  isEmailVerified: true,
  location: String(user.location || "Philippines").trim(),
  phone: String(user.phone || "").trim(),
  bio: String(user.bio || "").trim(),
  interests: Array.isArray(user.interests)
    ? user.interests.map((interest) => String(interest || "").trim()).filter(Boolean)
    : [],
  avatar: String(user.avatar || user.profilePic || "").trim(),
  lastSeededAt: new Date(),
});

export const syncMockUserCatalog = async ({ reason = "manual" } = {}) => {
  const normalizedUsers = mockUsers
    .map((user) => normalizeMockUserRecord(user))
    .filter((user) => user.email && user.username && user.name);

  if (normalizedUsers.length === 0) {
    return {
      reason,
      count: 0,
      seededAt: new Date().toISOString(),
    };
  }

  await User.bulkWrite(
    normalizedUsers.map((user) => ({
      updateOne: {
        filter: { email: user.email },
        update: {
          $set: user,
          $setOnInsert: {
            password: buildMockPassword(user.username),
            followers: [],
            following: [],
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  await User.deleteMany({
    source: "mock",
    email: {
      $nin: normalizedUsers.map((user) => user.email),
    },
  });

  const seededAt = new Date().toISOString();
  console.log(
    `[mockUserCatalog] Synced ${normalizedUsers.length} mock users (${reason})`,
  );

  return {
    reason,
    count: normalizedUsers.length,
    seededAt,
  };
};

export const ensureMockUserCatalogSeeded = async () => {
  const existingCount = await User.countDocuments({ source: "mock" });

  if (existingCount > 0) {
    return {
      count: existingCount,
      seeded: false,
    };
  }

  if (!seedPromise) {
    seedPromise = syncMockUserCatalog({ reason: "startup" }).finally(() => {
      seedPromise = null;
    });
  }

  return seedPromise;
};

export const getMockUserCatalogStatus = async () => ({
  storedCount: await User.countDocuments({ source: "mock" }),
  configuredCount: mockUsers.length,
});
