import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const encodedKey = process.env.WEB_PUSH_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("Set WEB_PUSH_ENCRYPTION_KEY to a base64-encoded 32-byte key before enabling browser push.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("WEB_PUSH_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function hashWebPushEndpoint(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function encryptWebPushSubscription(subscription) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(subscription), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return { encryptedSubscription: ciphertext.toString("base64"), encryptionIv: iv.toString("base64") };
}

export function decryptWebPushSubscription(encryptedSubscription, encryptionIv) {
  const ciphertext = Buffer.from(encryptedSubscription, "base64");
  if (ciphertext.length <= 16) throw new Error("Saved browser push subscription data is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(encryptionIv, "base64"));
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plaintext = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ]).toString("utf8");
  const subscription = JSON.parse(plaintext);
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.keys || typeof subscription.keys.p256dh !== "string" || typeof subscription.keys.auth !== "string") {
    throw new Error("Saved browser push subscription data is invalid.");
  }
  return subscription;
}
