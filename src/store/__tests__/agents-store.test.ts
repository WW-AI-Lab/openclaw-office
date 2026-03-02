import { describe, it, expect, beforeEach } from "vitest";
import { initAdapter } from "@/gateway/adapter-provider";
import { useAgentsStore } from "../console-stores/agents-store";

describe("Agents Store", () => {
  beforeEach(async () => {
    await initAdapter("mock");
    useAgentsStore.setState({
      agents: [],
      defaultAgentId: "",
      selectedAgentId: null,
      activeTab: "overview",
      isLoading: false,
      error: null,
      searchQuery: "",
      files: [],
      filesLoading: false,
      selectedFileName: null,
      fileContent: null,
      originalFileContent: null,
      isFileDirty: false,
      fileSaving: false,
      createDialogOpen: false,
      deleteDialogOpen: false,
    });
  });

  it("fetchAgents() loads agents from mock adapter", async () => {
    await useAgentsStore.getState().fetchAgents();
    const s = useAgentsStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.agents.length).toBe(4);
    expect(s.defaultAgentId).toBe("main");
    expect(s.agents[0].default).toBe(true);
  });

  it("selectAgent() updates selectedAgentId and resets tab", () => {
    useAgentsStore.getState().setActiveTab("files");
    useAgentsStore.getState().selectAgent("coder");
    const s = useAgentsStore.getState();
    expect(s.selectedAgentId).toBe("coder");
    expect(s.activeTab).toBe("overview");
  });

  it("setActiveTab() switches tab", () => {
    useAgentsStore.getState().setActiveTab("files");
    expect(useAgentsStore.getState().activeTab).toBe("files");
  });

  it("setSearchQuery() updates search", () => {
    useAgentsStore.getState().setSearchQuery("code");
    expect(useAgentsStore.getState().searchQuery).toBe("code");
  });

  it("fetchFiles() loads files for agent", async () => {
    await useAgentsStore.getState().fetchFiles("main");
    const s = useAgentsStore.getState();
    expect(s.files.length).toBeGreaterThan(0);
    expect(s.files.some((f) => f.name === "SOUL.md")).toBe(true);
  });

  it("fetchFileContent() loads file content", async () => {
    await useAgentsStore.getState().fetchFileContent("main", "SOUL.md");
    const s = useAgentsStore.getState();
    expect(s.selectedFileName).toBe("SOUL.md");
    expect(s.fileContent).toBeTruthy();
    expect(s.isFileDirty).toBe(false);
  });

  it("setFileContent() marks dirty when content changes", async () => {
    await useAgentsStore.getState().fetchFileContent("main", "SOUL.md");
    useAgentsStore.getState().setFileContent("modified content");
    expect(useAgentsStore.getState().isFileDirty).toBe(true);
  });

  it("resetFileContent() restores original content", async () => {
    await useAgentsStore.getState().fetchFileContent("main", "SOUL.md");
    const original = useAgentsStore.getState().fileContent;
    useAgentsStore.getState().setFileContent("modified");
    useAgentsStore.getState().resetFileContent();
    expect(useAgentsStore.getState().fileContent).toBe(original);
    expect(useAgentsStore.getState().isFileDirty).toBe(false);
  });

  it("saveFileContent() saves and clears dirty flag", async () => {
    await useAgentsStore.getState().fetchFileContent("main", "SOUL.md");
    useAgentsStore.getState().setFileContent("new content");
    const ok = await useAgentsStore.getState().saveFileContent("main", "SOUL.md", "new content");
    expect(ok).toBe(true);
    expect(useAgentsStore.getState().isFileDirty).toBe(false);
  });

  it("createAgent() creates and refreshes list", async () => {
    await useAgentsStore.getState().fetchAgents();
    const agentId = await useAgentsStore.getState().createAgent({
      name: "TestAgent",
      workspace: "~/.openclaw/workspace-test",
    });
    expect(agentId).toBeTruthy();
    expect(useAgentsStore.getState().agents.length).toBe(4);
  });

  it("deleteAgent() removes agent and auto-selects default", async () => {
    await useAgentsStore.getState().fetchAgents();
    useAgentsStore.getState().selectAgent("coder");
    const ok = await useAgentsStore.getState().deleteAgent("coder", false);
    expect(ok).toBe(true);
    // After delete, fetchAgents re-runs and auto-selects default
    expect(useAgentsStore.getState().selectedAgentId).toBe("main");
  });

  it("updateAgentModel() updates model config", async () => {
    const ok = await useAgentsStore
      .getState()
      .updateAgentModel("main", "anthropic/claude-sonnet-4");
    expect(ok).toBe(true);
  });

  it("dialog state management", () => {
    useAgentsStore.getState().setCreateDialogOpen(true);
    expect(useAgentsStore.getState().createDialogOpen).toBe(true);
    useAgentsStore.getState().setCreateDialogOpen(false);
    expect(useAgentsStore.getState().createDialogOpen).toBe(false);

    useAgentsStore.getState().setDeleteDialogOpen(true);
    expect(useAgentsStore.getState().deleteDialogOpen).toBe(true);
  });
});
