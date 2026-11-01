// @vitest-environment jsdom
import React, {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {expect, it, vi} from "vitest";
import {ComicModal} from "../src/components/ComicDialogs";

it("handles Escape cancellation immediately instead of waiting for the queued close event", () => {
  vi.stubGlobal("React", React);Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  const prototype = HTMLDialogElement.prototype;
  const show = Object.getOwnPropertyDescriptor(prototype, "showModal"), close = Object.getOwnPropertyDescriptor(prototype, "close");
  Object.defineProperty(prototype, "showModal", {configurable: true, value() {this.open = true;}});
  Object.defineProperty(prototype, "close", {configurable: true, value() {this.open = false;}});
  const host = document.createElement("div");document.body.append(host);const root = createRoot(host), onClose = vi.fn();
  try {
    act(() => root.render(createElement(ComicModal, {title: "Settings", onClose, children: "Content"})));
    const cancel = new Event("cancel", {cancelable: true});
    act(() => host.querySelector("dialog")!.dispatchEvent(cancel));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
  } finally {
    act(() => root.unmount());host.remove();vi.unstubAllGlobals();
    if (show) Object.defineProperty(prototype, "showModal", show);else delete (prototype as Partial<HTMLDialogElement>).showModal;
    if (close) Object.defineProperty(prototype, "close", close);else delete (prototype as Partial<HTMLDialogElement>).close;
  }
});
