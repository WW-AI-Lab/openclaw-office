export interface AuthCredentials {
  gatewayUrl: string;
  token: string;
  password: string;
}

const STORAGE_KEY = "openclaw-office.auth.v1";

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredCredentials(): AuthCredentials | null {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthCredentials>;
    if (typeof parsed.gatewayUrl !== "string") {
      return null;
    }
    return {
      gatewayUrl: parsed.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : "",
      password: typeof parsed.password === "string" ? parsed.password : "",
    };
  } catch {
    return null;
  }
}

export function saveStoredCredentials(credentials: AuthCredentials): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // best-effort; ignore quota / privacy errors
  }
}

export function clearStoredCredentials(): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export type ConnectErrorKind = "auth" | "network";

// Mirror of OpenClaw control UI auth-error detection (ui/src/ui/views/overview-hints.ts).
// Office only receives the error message string from the Gateway, so we match on
// the canonical auth error codes/keywords that appear in those messages.
const AUTH_ERROR_PATTERNS = [
  "auth_required",
  "auth_token_missing",
  "auth_password_missing",
  "auth_token_not_configured",
  "auth_password_not_configured",
  "auth_unauthorized",
  "auth_token_mismatch",
  "auth_password_mismatch",
  "auth_device_token_mismatch",
  "auth_rate_limited",
  "unauthorized",
  "authentication required",
  "invalid token",
  "invalid password",
];

/**
 * Classify a Gateway connect error. Only "auth" failures should send the user
 * back to the login gate; transient network errors keep an authenticated
 * session and let the reconnect logic recover.
 */
export function classifyConnectError(message: string | null | undefined): ConnectErrorKind {
  if (!message) {
    return "network";
  }
  const lower = message.toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => lower.includes(pattern)) ? "auth" : "network";
}

/** Redact credential-looking substrings before surfacing an error to the UI. */
export function redactAuthError(value: string): string {
  return value
    .replace(
      /([?#&])(?:access_token|auth|deviceToken|password|refresh_token|token)=([^&#\s]+)/gi,
      "$1[redacted]",
    )
    .replace(/\bBearer\s+([A-Za-z0-9._~+/-]+=*)/gi, "Bearer [redacted]")
    .replace(
      /(["']?(?:access|accessToken|deviceToken|password|refresh|refreshToken|token)["']?\s*[:=]\s*)["']?[^"',\s}]+/gi,
      "$1[redacted]",
    );
}
