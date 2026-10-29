// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ adminRequest: vi.fn() }));
import { adminRequest } from "../src/lib/supabase";
import { DraftReview } from "../src/components/AdminTools";
it("does not show a previous chapter comparison after switching chapters mid-request", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let resolve!: (v: unknown) => void;
  vi.mocked(adminRequest).mockImplementationOnce(
    () => new Promise((r) => (resolve = r)),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const props = {
    locale: "vi" as const,
    editionLocale: "vi" as const,
    form: { title: "New", html: "<p>New</p>", kind: "text", pdfPath: "" },
    issues: null,
    onIssues: vi.fn(),
    onError: vi.fn(),
  };
  await act(async () =>
    root.render(
      React.createElement(DraftReview, { ...props, id: "chapter-1" }),
    ),
  );
  await act(async () => {
    (host.querySelector("button") as HTMLButtonElement).click();
  });
  await act(async () =>
    root.render(
      React.createElement(DraftReview, { ...props, id: "chapter-2" }),
    ),
  );
  await act(async () =>
    resolve({ items: [{ id: "old", title: "Old chapter" }] }),
  );
  expect(host.querySelector(".version-diff")).toBeNull();
  await act(async () => root.unmount());
  host.remove();
});

it("hides stale comparison content while loading and does not reopen a closed comparison", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(adminRequest).mockReset();
  const version = { id: "old", revision: 1, title: "Old", html: "<p>Old</p>" };
  let resolve!: (v: unknown) => void;
  vi.mocked(adminRequest)
    .mockResolvedValueOnce({ items: [version] })
    .mockResolvedValueOnce({ items: [version] })
    .mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    props = {
      locale: "vi" as const,
      editionLocale: "vi" as const,
      id: "chapter-1",
      form: { title: "New", html: "<p>New</p>", kind: "text", pdfPath: "" },
      issues: null,
      onIssues: vi.fn(),
      onError: vi.fn(),
    };
  await act(async () => root.render(React.createElement(DraftReview, props)));
  await act(async () => {
    (host.querySelector("button") as HTMLButtonElement).click();
  });
  const select = host.querySelector("select")!;
  await act(async () => {
    select.value = "old";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.querySelector(".version-diff .diff-added")).toBeNull();
  const close = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Đóng so sánh",
  )!;
  await act(async () => close.click());
  await act(async () => resolve(version));
  expect(host.querySelector(".version-diff")).toBeNull();
  await act(async () => root.unmount());
  host.remove();
});
