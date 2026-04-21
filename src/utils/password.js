import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const HASH_PREFIX = "pbkdf2";
const HASH_DIGEST = "sha256";
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;

export const isPasswordHashed = (value) =>
  typeof value === "string" && value.startsWith(`${HASH_PREFIX}$`);

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    String(password),
    salt,
    HASH_ITERATIONS,
    HASH_KEY_LENGTH,
    HASH_DIGEST,
  ).toString("hex");

  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
};

export const verifyPassword = (password, storedPassword) => {
  if (typeof storedPassword !== "string" || !storedPassword) {
    return false;
  }

  if (!isPasswordHashed(storedPassword)) {
    return storedPassword === String(password);
  }

  const [prefix, iterationText, salt, storedHash] = storedPassword.split("$");

  if (prefix !== HASH_PREFIX || !iterationText || !salt || !storedHash) {
    return false;
  }

  const derivedHash = pbkdf2Sync(
    String(password),
    salt,
    Number(iterationText),
    HASH_KEY_LENGTH,
    HASH_DIGEST,
  );
  const expectedHash = Buffer.from(storedHash, "hex");

  if (derivedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedHash, expectedHash);
};

export const passwordNeedsMigration = (storedPassword) =>
  typeof storedPassword === "string" && storedPassword.length > 0 && !isPasswordHashed(storedPassword);
