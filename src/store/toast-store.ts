import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  detail?: string;
  duration: number;
  createdAt: number;
}

interface ToastInput {
  type: ToastType;
  title: string;
  message?: string;
  detail?: string;
  duration?: number;
}

const MAX_TOASTS = 5;

interface ToastStoreState {
  toasts: ToastItem[];
  addToast: (input: ToastInput) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],

  addToast: (input) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      detail: input.detail,
      duration: input.duration ?? 5000,
      createdAt: Date.now(),
    };
    set((s) => {
      const next = [...s.toasts, item];
      if (next.length > MAX_TOASTS) next.shift();
      return { toasts: next };
    });
    return id;
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearAll: () => set({ toasts: [] }),
}));

export function toastSuccess(title: string, message?: string): string {
  return useToastStore.getState().addToast({ type: "success", title, message });
}

export function toastError(title: string, message?: string, detail?: string): string {
  return useToastStore.getState().addToast({ type: "error", title, message, detail, duration: 0 });
}

export function toastWarning(title: string, message?: string, detail?: string): string {
  return useToastStore.getState().addToast({ type: "warning", title, message, detail });
}

export function toastInfo(title: string, message?: string): string {
  return useToastStore.getState().addToast({ type: "info", title, message });
}
