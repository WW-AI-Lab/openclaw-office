import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n/test-setup";
import { ProvidersSection } from "@/components/console/settings/ProvidersSection";
import { useConfigStore } from "@/store/console-stores/config-store";

vi.mock("@/components/console/settings/AddProviderDialog", () => ({
  AddProviderDialog: ({ open, onSave }: { open: boolean; onSave: Function }) =>
    open ? (
      <div>
        <button onClick={() => onSave("new-save", { baseUrl: "https://save" }, "save")}>
          mock-add-save
        </button>
        <button onClick={() => onSave("new-apply", { baseUrl: "https://apply" }, "apply")}>
          mock-add-apply
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/console/settings/EditProviderDialog", () => ({
  EditProviderDialog: ({ open, onSave }: { open: boolean; onSave: Function }) =>
    open ? (
      <div>
        <button onClick={() => onSave({ baseUrl: "https://edited" }, "save")}>mock-edit-save</button>
        <button onClick={() => onSave({ baseUrl: "https://edited" }, "apply")}>
          mock-edit-apply
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/console/settings/ProviderCard", () => ({
  ProviderCard: ({
    providerId,
    onEdit,
  }: {
    providerId: string;
    onEdit: () => void;
  }) => <button onClick={onEdit}>edit-{providerId}</button>,
}));

vi.mock("@/components/console/settings/CatalogProviderCard", () => ({
  CatalogProviderCard: () => null,
}));

vi.mock("@/components/console/shared/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("@/components/console/shared/EmptyState", () => ({
  EmptyState: () => null,
}));

describe("ProvidersSection", () => {
  beforeEach(() => {
    useConfigStore.setState({
      config: {
        models: {
          providers: {
            existing: { baseUrl: "https://existing" },
          },
        },
      },
      catalogModels: [],
      lifecycleState: null,
      restartState: null,
    });
  });

  it("routes add-save through saveConfig", async () => {
    const saveConfig = vi.fn(async (updater: (config: Record<string, unknown>) => Record<string, unknown>) => {
      const next = updater(structuredClone(useConfigStore.getState().config ?? {}));
      useConfigStore.setState({ config: next });
      return { ok: true, config: next };
    });
    const applyConfig = vi.fn();
    const fetchCatalogModels = vi.fn();

    useConfigStore.setState({ saveConfig, applyConfig, fetchCatalogModels });

    render(<ProvidersSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "添加提供方" }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByText("mock-add-save"));
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(applyConfig).not.toHaveBeenCalled();
  });

  it("routes add-apply through applyConfig", async () => {
    const saveConfig = vi.fn();
    const applyConfig = vi.fn(
      async (updater: (config: Record<string, unknown>) => Record<string, unknown>) => {
        const next = updater(structuredClone(useConfigStore.getState().config ?? {}));
        useConfigStore.setState({ config: next });
        return { ok: true, config: next, restart: { scheduled: true, delayMs: 500 } };
      },
    );
    const fetchCatalogModels = vi.fn();

    useConfigStore.setState({ saveConfig, applyConfig, fetchCatalogModels });

    render(<ProvidersSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "添加提供方" }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByText("mock-add-apply"));
    });

    expect(applyConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("routes edit-apply through applyConfig", async () => {
    const saveConfig = vi.fn();
    const applyConfig = vi.fn(
      async (updater: (config: Record<string, unknown>) => Record<string, unknown>) => {
        const next = updater(structuredClone(useConfigStore.getState().config ?? {}));
        useConfigStore.setState({ config: next });
        return { ok: true, config: next, restart: { scheduled: true, delayMs: 500 } };
      },
    );
    const fetchCatalogModels = vi.fn();

    useConfigStore.setState({ saveConfig, applyConfig, fetchCatalogModels });

    render(<ProvidersSection />);
    await act(async () => {
      fireEvent.click(screen.getByText("edit-existing"));
    });
    await act(async () => {
      fireEvent.click(await screen.findByText("mock-edit-apply"));
    });

    expect(applyConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).not.toHaveBeenCalled();
  });
});
