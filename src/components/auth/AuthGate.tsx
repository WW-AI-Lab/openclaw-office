import type { ReactNode } from "react";
import { isMockMode } from "@/gateway/adapter-provider";
import { useAuthStore } from "@/store/auth-store";
import { LoginGate } from "./LoginGate";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Access guard. Blocks the whole application until the user is authenticated
 * against the OpenClaw Gateway (i.e. a successful connect handshake). Mock mode
 * bypasses authentication entirely.
 */
export function AuthGate({ children }: AuthGateProps) {
  const authStatus = useAuthStore((s) => s.authStatus);

  if (isMockMode() || authStatus === "authenticated") {
    return <>{children}</>;
  }

  return <LoginGate />;
}
