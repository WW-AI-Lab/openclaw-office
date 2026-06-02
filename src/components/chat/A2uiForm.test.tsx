import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { A2uiForm } from "@/components/chat/A2uiForm";
import { parseA2ui, type A2uiForm as A2uiFormModel } from "@/lib/a2ui-schema";

const FORM = parseA2ui(
  JSON.stringify({
    skill: "demo",
    title: "Demo 表单",
    fields: [
      { key: "name", label: "名称", type: "text", required: true },
      { key: "size", label: "尺寸", type: "select", options: [{ label: "小", value: "s" }, { label: "大", value: "l" }] },
    ],
  }),
) as A2uiFormModel;

describe("A2uiForm", () => {
  it("renders title and fields", () => {
    render(<A2uiForm form={FORM} />);
    expect(screen.getByText("Demo 表单")).toBeInTheDocument();
    expect(screen.getByText("名称")).toBeInTheDocument();
  });

  it("blocks submit and surfaces missing required fields", () => {
    const onSubmit = vi.fn();
    render(<A2uiForm form={FORM} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("提交"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits collected values once required fields are filled", () => {
    const onSubmit = vi.fn();
    render(<A2uiForm form={FORM} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "盒子" } });
    fireEvent.click(screen.getByText("提交"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "盒子" }), undefined);
  });

  it("invokes onUseText escape hatch", () => {
    const onUseText = vi.fn();
    render(<A2uiForm form={FORM} onUseText={onUseText} />);
    fireEvent.click(screen.getByText("改用文字回答"));
    expect(onUseText).toHaveBeenCalled();
  });

  it("does not call onSubmit when readOnly", () => {
    const onSubmit = vi.fn();
    render(<A2uiForm form={FORM} readOnly onSubmit={onSubmit} />);
    expect(screen.queryByText("提交")).not.toBeInTheDocument();
  });
});
