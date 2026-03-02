import { create } from "zustand";
import type { AdapterEventHandler } from "@/gateway/adapter";
import { getAdapter, waitForAdapter } from "@/gateway/adapter-provider";
import type { CronTask, CronTaskInput, CronJobState } from "@/gateway/adapter-types";

interface CronStoreState {
  tasks: CronTask[];
  isLoading: boolean;
  error: string | null;

  dialogOpen: boolean;
  editingTask: CronTask | null;

  fetchTasks: () => Promise<void>;
  addTask: (input: CronTaskInput) => Promise<void>;
  updateTask: (id: string, patch: Partial<CronTaskInput>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  runTask: (id: string) => Promise<void>;

  openDialog: (task?: CronTask) => void;
  closeDialog: () => void;
  handleCronEvent: (event: { jobId?: string; state?: CronJobState }) => void;
  initEventListeners: () => () => void;
}

export const useCronStore = create<CronStoreState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  dialogOpen: false,
  editingTask: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      await waitForAdapter();
      const tasks = await getAdapter().cronList();
      set({ tasks, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addTask: async (input) => {
    try {
      const task = await getAdapter().cronAdd(input);
      set((s) => ({ tasks: [...s.tasks, task], dialogOpen: false, editingTask: null }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  updateTask: async (id, patch) => {
    try {
      const updated = await getAdapter().cronUpdate(id, patch);
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
        dialogOpen: false,
        editingTask: null,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  removeTask: async (id) => {
    try {
      await getAdapter().cronRemove(id);
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  runTask: async (id) => {
    try {
      await getAdapter().cronRun(id);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  openDialog: (task) => set({ dialogOpen: true, editingTask: task ?? null }),
  closeDialog: () => set({ dialogOpen: false, editingTask: null }),

  handleCronEvent: (event) => {
    if (!event.jobId || !event.state) return;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === event.jobId ? { ...t, state: { ...t.state, ...event.state } } : t,
      ),
    }));
  },

  initEventListeners: () => {
    const handler: AdapterEventHandler = (eventName, payload) => {
      if (eventName === "cron") {
        get().handleCronEvent(payload as { jobId?: string; state?: CronJobState });
      }
    };
    let disposed = false;
    let unsubscribe = () => {};

    void waitForAdapter()
      .then(() => {
        if (disposed) return;
        unsubscribe = getAdapter().onEvent(handler);
      })
      .catch(() => {
        unsubscribe = () => {};
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  },
}));
