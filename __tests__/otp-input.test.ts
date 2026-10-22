import { createElement, type ChangeEvent, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { OtpInput } from "@/components/ui/OtpInput";

const f = vi.hoisted(() => ({ nodes: Array.from({ length: 6 }, () => ({ focus: vi.fn() })) }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useRef: () => ({ current: f.nodes }) }));
beforeEach(() => vi.clearAllMocks());
function inputs(value: string, onChange = vi.fn()) {
  const tree = OtpInput({ value, onChange });
  return { fields: tree.props.children as ReactElement<InputHTMLAttributes<HTMLInputElement>>[], onChange };
}
it("renders six accessible digit fields with a single autofill entry point", () => {
  const html = renderToStaticMarkup(createElement(OtpInput, { value: "012345", onChange: () => {} }));
  expect(html.match(/<input /g)).toHaveLength(6);
  expect(html.match(/one-time-code/g)).toHaveLength(1);
  expect(html).toContain('value="0"');
  expect(html).toContain('aria-label="Chữ số 6"');
});
it("advances focus after typing a digit", () => {
  const { fields, onChange } = inputs("");
  fields[0].props.onChange?.({ target: { value: "0" } } as ChangeEvent<HTMLInputElement>);
  expect(onChange).toHaveBeenCalledWith("0");
  expect(f.nodes[1].focus).toHaveBeenCalled();
});
it("fills all six fields on paste, preserving leading zero and removing non-numeric text", () => {
  const { fields, onChange } = inputs("");
  const preventDefault = vi.fn();
  fields[2].props.onPaste?.({ preventDefault, clipboardData: { getData: () => "03 85-80" } } as unknown as ClipboardEvent<HTMLInputElement>);
  expect(preventDefault).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith("038580");
  expect(f.nodes[5].focus).toHaveBeenCalled();
});
it("deletes a middle digit without shifting the other positions", () => {
  const { fields, onChange } = inputs("123456");
  fields[2].props.onKeyDown?.({ key: "Backspace", preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLInputElement>);
  expect(onChange).toHaveBeenCalledWith("12 456");
  expect(f.nodes[2].focus).toHaveBeenCalled();
});
it("moves back and clears the previous digit when Backspace is pressed in an empty field", () => {
  const { fields, onChange } = inputs("12");
  fields[2].props.onKeyDown?.({ key: "Backspace", preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLInputElement>);
  expect(onChange).toHaveBeenCalledWith("1");
  expect(f.nodes[1].focus).toHaveBeenCalled();
});
