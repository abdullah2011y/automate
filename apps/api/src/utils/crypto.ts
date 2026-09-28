import crypto from 'crypto';
import { config } from '../config';

/**
 * Derives a consistent 32-byte key buffer from the configuration string.
 */
function getKeyBuffer(): Buffer {
  const key = config.ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Fallback: SHA-256 hash to ensure exact 32-byte buffer
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts sensitive credentials (like Shopify access tokens) using AES-256-GCM at rest.
 * Output format: ivHex:authTagHex:ciphertextHex
 */
export function encryptCredential(plainText: string): string {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted credentials.
 */
export function decryptCredential(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential payload structure');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getKeyBuffer();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Validates and normalizes Shopify store domains.
 * Rejects malicious schemes, invalid characters, or non-myshopify domains.
 */
export function sanitizeShopDomain(rawDomain: string): string | null {
  if (!rawDomain || typeof rawDomain !== 'string') return null;

  const domain = rawDomain.trim().toLowerCase();

  // Strictly reject URLs containing protocols, ports, paths, or query strings
  if (/[/:?#]/.test(domain)) {
    return null;
  }

  // Must match standard Shopify subdomain pattern: [a-zA-Z0-9-].myshopify.com
  const shopifyRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  if (!shopifyRegex.test(domain)) {
    return null;
  }

  return domain;
}

/**
 * Verifies Shopify Webhook HMAC-SHA256 signature using the exact raw request bytes.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyShopifyWebhookHmac(
  rawBody: Buffer | undefined,
  hmacHeader: string | undefined,
  secret: string
): boolean {
  if (!rawBody || !hmacHeader || !secret) {
    return false;
  }

  try {
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const headerBuf = Buffer.from(hmacHeader, 'utf8');
    const computedBuf = Buffer.from(computedHmac, 'utf8');

    if (headerBuf.length !== computedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(headerBuf, computedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Verifies Meta WhatsApp Cloud API X-Hub-Signature-256 header using the exact raw request bytes.
 * Header format: sha256=<hex_digest>
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!rawBody || !signatureHeader || !appSecret) {
    return false;
  }

  try {
    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const expectedHash = parts[1];
    const computedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const headerBuf = Buffer.from(expectedHash, 'utf8');
    const computedBuf = Buffer.from(computedHash, 'utf8');

    if (headerBuf.length !== computedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(headerBuf, computedBuf);
  } catch (err) {
    return false;
  }
}
