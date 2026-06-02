import { create } from "zustand";
import {
  type AuthCredentials,
  clearStoredCredentials,
  loadStoredCredentials,
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
    const stored = loadStoredCredentials();
    if (stored) {
      set({
        defaults,
        gatewayUrl: stored.gatewayUrl,
        token: stored.token,
        password: stored.password,
        rememberCredentials: true,
        authStatus: "authenticating",
        authError: null,
      });
      return;
    }
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
