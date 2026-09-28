/**
 * Normalizes a phone number into valid E.164 international format (+92...).
 * Specifically handles common Pakistani entry variations from Shopify checkouts:
 * - 03001234567  -> +923001234567
 * - 3001234567   -> +923001234567
 * - 923001234567 -> +923001234567
 * - +03001234567 -> +923001234567
 * - 00923001234567 -> +923001234567
 */
export function normalizePhoneNumber(
  rawPhone: string | null | undefined,
  defaultCountryCode: string = 'PK'
): string {
  if (!rawPhone) return '+000000000000';
  let cleaned = String(rawPhone).replace(/[^\d+]/g, '').trim();
  if (!cleaned) return '+000000000000';

  // Strip international dialing prefix 00
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // Already prefixed with '+'
  if (cleaned.startsWith('+')) {
    // If entered as +03001234567 (with extra leading 0), fix to +92
    if (/^\+03\d{9}$/.test(cleaned)) {
      return `+92${cleaned.slice(2)}`;
    }
    return cleaned;
  }

  // Pakistan local 11 digits starting with 03 (e.g. 03001234567)
  if (/^03\d{9}$/.test(cleaned)) {
    return `+92${cleaned.slice(1)}`;
  }

  // Pakistan local 10 digits starting with 3 (e.g. 3001234567)
  if (/^3\d{9}$/.test(cleaned)) {
    return `+92${cleaned}`;
  }

  // Pakistan 12 digits starting with 923 (e.g. 923001234567)
  if (/^923\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If default country is PK and length is 10 digits
  if (defaultCountryCode.toUpperCase() === 'PK' && cleaned.length === 10 && cleaned.startsWith('3')) {
    return `+92${cleaned}`;
  }

  // Generic fallback: prepend +
  return `+${cleaned}`;
}

/**
 * Converts any phone number or JID to standard Baileys WhatsApp JID (@s.whatsapp.net).
 */
export function toWhatsAppJid(phone: string): string {
  if (phone.includes('@')) {
    return phone;
  }
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

/**
 * Checks whether a payment gateway name represents Cash on Delivery.
 * Accommodates Shopify's varied gateway strings:
 * - "Cash on Delivery (COD)"
 * - "cash_on_delivery"
 * - "COD"
 * - "manual"
 * - "Cash on delivery"
 */
export function isCodGateway(gateway: string | null | undefined): boolean {
  if (!gateway) return false;
  const g = gateway.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    g.includes('cashondelivery') ||
    g.includes('cod') ||
    g.includes('manual') ||
    g === 'cash'
  );
}

/**
 * Normalizes payment gateway name for database storage.
 */
export function normalizeGateway(gateway: string | null | undefined): string {
  if (!gateway) return 'cash_on_delivery';
  if (isCodGateway(gateway)) {
    return 'cash_on_delivery';
  }
  return gateway.trim();
}
