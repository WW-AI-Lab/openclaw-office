import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginGate } from "@/components/auth/LoginGate";
import { useAuthStore } from "@/store/auth-store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/shared/LanguageSwitcher", () => ({
  LanguageSwitcher: () => null,
}));

const INITIAL = useAuthStore.getState();

describe("LoginGate", () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        ...INITIAL,
        gatewayUrl: "",
        token: "",
        password: "",
        authStatus: "unauthenticated",
        authError: null,
        defaults: { gatewayUrl: "", token: "" },
      });
    });
  });

  // <App> seeds the store inside an effect, which React runs only after this
  // component has mounted. Rendering first and hydrating second is not an
  // artificial ordering — it is exactly what happens in the browser.
  it("backfills the form when defaults arrive after mount", () => {
    render(<LoginGate />);

    expect(screen.getByLabelText<HTMLInputElement>("fields.gatewayUrl").value).toBe("");

    act(() => {
      useAuthStore
        .getState()
        .hydrate({ gatewayUrl: "ws://gateway.test/gateway-ws", token: "tok-123" });
    });

    expect(screen.getByLabelText<HTMLInputElement>("fields.gatewayUrl").value).toBe(
      "ws://gateway.test/gateway-ws",
    );
    expect(screen.getByLabelText<HTMLInputElement>("fields.token").value).toBe("tok-123");
  });

  it("keeps values the user already typed", () => {
    act(() => {
      useAuthStore.getState().hydrate({ gatewayUrl: "ws://first.test", token: "first" });
    });

    render(<LoginGate />);

    const url = screen.getByLabelText<HTMLInputElement>("fields.gatewayUrl");
    act(() => {
      url.focus();
    });
    act(() => {
      // Simulate a correction typed by the user before the store settles.
      useAuthStore.setState({ gatewayUrl: "ws://second.test", token: "second" });
    });

    // A later default must never clobber what is already in the field.
    expect(screen.getByLabelText<HTMLInputElement>("fields.gatewayUrl").value).toBe(
      "ws://first.test",
    );
  });
});
