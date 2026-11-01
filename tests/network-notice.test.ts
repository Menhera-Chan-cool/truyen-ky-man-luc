// @vitest-environment jsdom
import React, {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import NetworkNotice from "../src/components/NetworkNotice";

let root: Root, host: HTMLDivElement;
const render = (active = false, activity = "", locale: "vi" | "en" = "vi") =>
  act(() => root.render(createElement(NetworkNotice, {active, activity, locale})));
function connection(online: boolean) {
  Object.defineProperty(navigator, "onLine", {configurable: true, value: online});
  act(() => window.dispatchEvent(new Event(online ? "online" : "offline")));
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  Object.defineProperty(navigator, "onLine", {configurable: true, value: true});
  host = document.createElement("div");document.body.append(host);root = createRoot(host);
});
afterEach(() => {act(() => root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers();});

it("announces offline immediately, including when first opened offline", () => {
  connection(false);render();
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Mất kết nối");
  connection(true);expect(host.textContent).toBe("");
  connection(false);expect(host.textContent).toContain("Mất kết nối");
});
it("shows a slow-operation hint only after eight seconds without progress", () => {
  render(true, "1/3");act(() => vi.advanceTimersByTime(7999));expect(host.textContent).toBe("");
  render(true, "2/3");act(() => vi.advanceTimersByTime(7999));expect(host.textContent).toBe("");
  act(() => vi.advanceTimersByTime(1));expect(host.textContent).toContain("vẫn đang chờ");
  render(true, "3/3");expect(host.textContent).toBe("");
  act(() => vi.advanceTimersByTime(8000));render(false);expect(host.textContent).toBe("");
  act(() => vi.advanceTimersByTime(30000));expect(host.textContent).toBe("");
});
it("does not treat reconnecting as confirmation or retry an uncertain operation", () => {
  const fetch = vi.fn();vi.stubGlobal("fetch", fetch);
  render(true, "", "en");connection(false);expect(host.textContent).toContain("may still complete");
  act(() => vi.advanceTimersByTime(8000));connection(true);
  expect(host.textContent).toContain("still pending");expect(fetch).not.toHaveBeenCalled();
  render(false, "", "en");expect(host.textContent).toBe("");
});
it("cleans up timers and connection listeners on unmount", () => {
  render(true);expect(vi.getTimerCount()).toBe(1);
  act(() => root.unmount());expect(vi.getTimerCount()).toBe(0);
  connection(false);root = createRoot(host);render(false);expect(host.textContent).toContain("Mất kết nối");
});
