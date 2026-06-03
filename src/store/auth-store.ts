import { create } from "zustand";
import {
  type AuthCredentials,
  clearStoredCredentials,
  redactAuthError,
  saveStoredCredentials,
} from "@/gateway/auth-credentials";

export type AuthStatus = "unauthenticated" | "authenticating" | "authenticated";

interface AuthStoreState {
  gatewayUrl: string;
  token: string;
  password: string;
  rememberCredentials: boolean;
  authStatus: AuthStatus;
  authError: string | null;
  /** Default values used to prefill the login form (from env / injected config). */
  defaults: { gatewayUrl: string; token: string };

  hydrate: (defaults: { gatewayUrl: string; token: string }) => void;
  submitLogin: (credentials: AuthCredentials, remember: boolean) => void;
  markAuthenticated: () => void;
  markAuthFailed: (message: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  gatewayUrl: "",
  token: "",
  password: "",
  rememberCredentials: true,
  authStatus: "unauthenticated",
  authError: null,
  defaults: { gatewayUrl: "", token: "" },

  hydrate: (defaults) => {
    // Avoid clobbering an in-progress / completed session on re-mount.
    if (get().authStatus !== "unauthenticated") {
      return;
    }
    // Pre-fill the login form with the deployed defaults (env / injected
    // config). We intentionally do NOT auto-restore credentials from
    // localStorage: a stale token or URL from a previous deployment would
    // silently start a connect attempt, leave the UI stuck on "连接中..."
    // and block the user from submitting a corrected value. The user must
    // always re-submit the form explicitly after a restart.
    set({
      defaults,
      gatewayUrl: defaults.gatewayUrl,
      token: defaults.token,
      password: "",
      authStatus: "unauthenticated",
      authError: null,
    });
  },

  submitLogin: (credentials, remember) => {
    if (remember) {
      saveStoredCredentials(credentials);
    } else {
      clearStoredCredentials();
    }
    set({
      gatewayUrl: credentials.gatewayUrl,
      token: credentials.token,
      password: credentials.password,
      rememberCredentials: remember,
      authStatus: "authenticating",
      authError: null,
    });
  },

  markAuthenticated: () => {
    if (get().authStatus === "authenticated") {
      return;
    }
    set({ authStatus: "authenticated", authError: null });
  },

  markAuthFailed: (message) => {
    set({
      authStatus: "unauthenticated",
      authError: message ? redactAuthError(message) : null,
    });
  },

  logout: () => {
    clearStoredCredentials();
    const { defaults } = get();
    set({
      gatewayUrl: defaults.gatewayUrl,
      token: defaults.token,
      password: "",
      authStatus: "unauthenticated",
      authError: null,
    });
  },
}));
