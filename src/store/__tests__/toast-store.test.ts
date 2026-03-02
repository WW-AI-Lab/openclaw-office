import { describe, it, expect, beforeEach } from "vitest";
import { useToastStore, toastSuccess, toastError, toastWarning, toastInfo } from "../toast-store";

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe("useToastStore", () => {
  it("adds a toast and returns id", () => {
    const id = useToastStore.getState().addToast({
      type: "success",
      title: "Test",
    });
    expect(id).toBeTruthy();
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe("Test");
  });

  it("removes a toast by id", () => {
    const id = useToastStore.getState().addToast({ type: "info", title: "Remove me" });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("limits to 5 toasts max", () => {
    for (let i = 0; i < 7; i++) {
      useToastStore.getState().addToast({ type: "info", title: `Toast ${i}` });
    }
    expect(useToastStore.getState().toasts).toHaveLength(5);
    expect(useToastStore.getState().toasts[0].title).toBe("Toast 2");
  });

  it("clears all toasts", () => {
    useToastStore.getState().addToast({ type: "info", title: "A" });
    useToastStore.getState().addToast({ type: "info", title: "B" });
    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("sets correct default duration", () => {
    useToastStore.getState().addToast({ type: "info", title: "Test" });
    expect(useToastStore.getState().toasts[0].duration).toBe(5000);
  });

  it("preserves custom duration", () => {
    useToastStore.getState().addToast({ type: "info", title: "Test", duration: 10000 });
    expect(useToastStore.getState().toasts[0].duration).toBe(10000);
  });
});

describe("helper functions", () => {
  it("toastSuccess creates success toast", () => {
    toastSuccess("Done", "Details");
    const t = useToastStore.getState().toasts[0];
    expect(t.type).toBe("success");
    expect(t.title).toBe("Done");
    expect(t.message).toBe("Details");
  });

  it("toastError creates non-auto-closing error toast with detail", () => {
    toastError("Failed", "msg", "stderr output");
    const t = useToastStore.getState().toasts[0];
    expect(t.type).toBe("error");
    expect(t.duration).toBe(0);
    expect(t.detail).toBe("stderr output");
  });

  it("toastWarning creates warning toast", () => {
    toastWarning("Warn");
    expect(useToastStore.getState().toasts[0].type).toBe("warning");
  });

  it("toastInfo creates info toast", () => {
    toastInfo("Info");
    expect(useToastStore.getState().toasts[0].type).toBe("info");
  });
});
