/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() when available (modern browsers in secure contexts),
 * falls back to a crypto.getRandomValues()-based implementation for environments
 * where randomUUID is missing (e.g. HTTP pages, older browsers, some WebViews).
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: RFC 4122 version 4 UUID via getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version (4) and variant (RFC 4122) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
