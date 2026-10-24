import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useFormDraft } from "@/hooks/useFormDraft";

const defaults = { name: "" };
afterEach(() => vi.unstubAllGlobals());
it("does not read browser storage or render private draft content during SSR", () => {
  const read = vi.fn(() => { throw new Error("Storage must not be accessed during SSR"); });
  vi.stubGlobal("window", { localStorage: { getItem: read } });
  function Form() {
    const draft = useFormDraft("ssr-wallet-draft", defaults);
    return createElement("input", { value: draft.values.name, disabled: !draft.ready, readOnly: true });
  }
  expect(renderToStaticMarkup(createElement(Form))).toBe(renderToStaticMarkup(createElement(Form)));
  expect(read).not.toHaveBeenCalled();
});
