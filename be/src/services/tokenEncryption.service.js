import crypto from "node:crypto";
import { env } from "../config/env.js";

/**
 * Default isolated deterministic key material strictly for local test/dev environments.
 * Exactly 32 bytes (64 hex characters). NEVER used in production.
 */
const DETERMINISTIC_DEV_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Active key ring storing key version metadata and key buffers.
 * Default active key version is 'v1'.
 */
let keyRing = {
  currentVersion: "v1",
  keys: {
    v1: null,
  },
};

/**
 * Parses and strictly validates a 32-byte binary key from a string.
 * Supports 64-character hexadecimal encoding (recommended) or exact 32-byte UTF-8 string.
 *
 * @param {string} keyInput
 * @returns {Buffer} 32-byte key buffer
 */
export function parseEncryptionKey(keyInput) {
  if (!keyInput || typeof keyInput !== "string") {
    throw new Error("CONSENT_ENCRYPTION_KEY must be a non-empty string");
  }

  const trimmed = keyInput.trim();

  // 1. Check 64-character hexadecimal encoding (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // 2. Check exact 32-byte UTF-8 string
  const utf8Buf = Buffer.from(trimmed, "utf8");
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  throw new Error(
    "CONSENT_ENCRYPTION_KEY must be exactly 32 bytes (or 64 hexadecimal characters)"
  );
}

/**
 * Resolves the primary encryption key buffer.
 * In production: fails closed if CONSENT_ENCRYPTION_KEY is missing or invalid.
 * In development/test: uses configured key or isolated deterministic development key.
 *
 * @returns {Buffer} 32-byte key buffer
 */
export function getEncryptionKey() {
  if (keyRing.keys[keyRing.currentVersion]) {
    return keyRing.keys[keyRing.currentVersion];
  }

  const rawConfig = env.consentEncryptionKey;

  if (env.NODE_ENV === "production") {
    if (!rawConfig) {
      throw new Error(
        "CRITICAL_SECURITY_ERROR: CONSENT_ENCRYPTION_KEY is required in production environment. Refusing to start."
      );
    }
    const parsed = parseEncryptionKey(rawConfig);
    keyRing.keys[keyRing.currentVersion] = parsed;
    return parsed;
  }

  // Development / Test mode
  if (rawConfig) {
    const parsed = parseEncryptionKey(rawConfig);
    keyRing.keys[keyRing.currentVersion] = parsed;
    return parsed;
  }

  const devKey = parseEncryptionKey(DETERMINISTIC_DEV_KEY_HEX);
  keyRing.keys[keyRing.currentVersion] = devKey;
  return devKey;
}

/**
 * Resolves a specific key version from the key ring for decryption.
 * Supports smooth key rotation where older versions remain decryptable.
 *
 * @param {string} version
 * @returns {Buffer} 32-byte key buffer
 */
export function getKeyByVersion(version) {
  if (keyRing.keys[version]) {
    return keyRing.keys[version];
  }

  // If requested version is the current version, load it
  if (version === keyRing.currentVersion) {
    return getEncryptionKey();
  }

  throw new Error(`Encryption key version '${version}' is not available in key ring`);
}

/**
 * Sets up key ring for testing key rotation and versioning.
 *
 * @param {object} params
 * @param {string} params.currentVersion
 * @param {Record<string, string|Buffer>} params.keys
 */
export function setEncryptionKeyRingForTests({ currentVersion, keys }) {
  const parsedKeys = {};
  for (const [ver, val] of Object.entries(keys)) {
    parsedKeys[ver] = Buffer.isBuffer(val) ? val : parseEncryptionKey(val);
  }
  keyRing = {
    currentVersion,
    keys: parsedKeys,
  };
}

/**
 * Resets the key ring to initial state.
 */
export function resetEncryptionKeyRing() {
  keyRing = {
    currentVersion: "v1",
    keys: {
      v1: null,
    },
  };
}

/**
 * Encrypts a plaintext invitation token using AES-256-GCM.
 * Generates a unique 12-byte IV per encryption operation.
 *
 * @param {string} rawToken
 * @param {string} [keyVersion]
 * @returns {{ ciphertext: string, iv: string, tag: string, keyVersion: string }}
 */
export function encryptInvitationToken(rawToken, keyVersion = keyRing.currentVersion) {
  if (!rawToken || typeof rawToken !== "string") {
    throw new Error("rawToken is required for encryption");
  }

  const key = getKeyByVersion(keyVersion);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    keyVersion,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted invitation token.
 * Authenticates ciphertext with the 16-byte authentication tag.
 *
 * @param {object} params
 * @param {string} params.ciphertext Hex encoded ciphertext
 * @param {string} params.iv Hex encoded 12-byte IV
 * @param {string} params.tag Hex encoded 16-byte Auth Tag
 * @param {string} [params.keyVersion='v1']
 * @returns {string} Decrypted raw plaintext token
 */
export function decryptInvitationToken({ ciphertext, iv, tag, keyVersion = "v1" }) {
  if (!ciphertext || !iv || !tag) {
    throw new Error("ciphertext, iv, and tag are required for token decryption");
  }

  try {
    const key = getKeyByVersion(keyVersion);
    const ivBuffer = Buffer.from(iv, "hex");
    const tagBuffer = Buffer.from(tag, "hex");
    const encryptedBuffer = Buffer.from(ciphertext, "hex");

    if (ivBuffer.length !== 12) {
      throw new Error("Invalid IV length for AES-GCM (must be 12 bytes)");
    }
    if (tagBuffer.length !== 16) {
      throw new Error("Invalid Auth Tag length for AES-GCM (must be 16 bytes)");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error(`Gagal mendekripsi token undangan: ${err.message}`);
  }
}

/**
 * Re-encrypts an invitation secret under a new key version without exposing plaintext.
 * Validates successful decryption before encrypting with the new key version.
 *
 * @param {object} params
 * @param {string} params.ciphertext
 * @param {string} params.iv
 * @param {string} params.tag
 * @param {string} params.keyVersion
 * @param {string} [params.targetKeyVersion]
 * @returns {{ ciphertext: string, iv: string, tag: string, keyVersion: string }}
 */
export function reencryptInvitationToken({
  ciphertext,
  iv,
  tag,
  keyVersion,
  targetKeyVersion = keyRing.currentVersion,
}) {
  const plaintext = decryptInvitationToken({ ciphertext, iv, tag, keyVersion });
  return encryptInvitationToken(plaintext, targetKeyVersion);
}
