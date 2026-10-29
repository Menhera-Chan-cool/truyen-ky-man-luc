import { createRequire } from "node:module";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../", import.meta.url)),
  require = createRequire(new URL("../package.json", import.meta.url));
require("@next/env").loadEnvConfig(root, false, { info() {}, error() {} });
const { createClient } = require("@supabase/supabase-js"),
  { chromium, expect } = require("@playwright/test");
const config = { auth: { persistSession: false, autoRefreshToken: false } },
  service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    config,
  ),
  anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    config,
  ),
  base = process.env.BASE_URL ?? "http://127.0.0.1:3001",
  tag = "verify-expansion-" + randomUUID().slice(0, 8),
  ids = [tag + "-one", tag + "-two"];
const actors = [],
  assetPaths = [],
  secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY],
  report = { base, checks: [], cleanup: [], requestErrors: [] };
let browser,
  phase = "setup";
const ok = (r) => {
  if (r.error)
    throw Error(
      "Supabase request failed: " + (r.error.code ?? r.error.status ?? ""),
    );
  return r.data;
};
const publicHash = async () =>
  createHash("sha256")
    .update(JSON.stringify(ok(await anon.rpc("get_public_book"))))
    .digest("hex");
async function request(actor, path, body, method = "POST") {
  const r = await fetch(base + "/api/admin/" + path, {
    method,
    headers: {
      Authorization: "Bearer " + actor.token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
async function clean(label, fn) {
  try {
    ok(await fn());
    report.cleanup.push({ label, ok: true });
  } catch {
    report.cleanup.push({ label, ok: false });
  }
}
try {
  const before = await publicHash();
  for (let i = 0; i < 2; i++) {
    const email = tag + "-" + i + "@example.test",
      password = randomBytes(24).toString("base64url") + "aA1!",
      uid = ok(
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      ).user.id;
    actors.push({ email, password, uid });
    secrets.push(password);
    ok(
      await service
        .from("members")
        .insert({ user_id: uid, email, role: "editor", active: true }),
    );
    const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        config,
      ),
      session = ok(
        await client.auth.signInWithPassword({ email, password }),
      ).session;
    actors[i].client = client;
    actors[i].token = session.access_token;
    secrets.push(session.access_token);
  }
  const actor = actors[0],
    other = actors[1];
  for (const id of ids) {
    const r = await request(actor, "chapters", {
      action: "import",
      confirmReplace: false,
      items: [
        {
          id,
          locale: "vi",
          title: "QA " + id,
          html: "<p>Original Nguyễn Dữ</p>",
          kind: "text",
          expectedRevision: 0,
        },
      ],
    });
    assert.equal(r.status, 200);
  }
  const initial = ok(
      await service
        .from("chapter_editions")
        .select("*")
        .eq("chapter_id", ids[0])
        .eq("locale", "vi")
        .single(),
    ),
    otherHeads = ok(await service.from("chapter_editions").select("*")).filter(
      (h) => !ids.includes(h.chapter_id),
    );
  phase = "authenticated UI";
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("response", async (response) => {
    if (
      response.status() >= 400 &&
      new URL(response.url()).pathname.startsWith("/api/admin/")
    ) {
      let error = "";
      try {
        error = (await response.json()).error ?? "";
      } catch {}
      report.requestErrors.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
        error,
      });
    }
  });
  await page.goto(base + "/admin?lang=vi");
  await page.locator("input[type=email]").fill(actor.email);
  await page.locator("input[type=password]").fill(actor.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const chapterButton = page
    .locator(".editor-chapters")
    .getByRole("button", { name: new RegExp("QA " + ids[0]) });
  await chapterButton.click();
  await expect(page.locator(".tiptap")).toContainText("Original Nguyễn Dữ");
  await page
    .getByRole("button", { name: "So sánh phiên bản", exact: true })
    .click();
  await expect(page.locator(".version-diff .diff-added")).toContainText(
    "Original Nguyễn Dữ",
  );
  await page.locator(".tiptap").click();
  await page.locator(".tiptap").press("ControlOrMeta+A");
  await page.keyboard.insertText("Reviewed Nguyễn Dữ");
  await expect(
    page.getByText("Hãy lưu bản nháp trước khi xuất bản.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu bản nháp." }),
  ).toBeVisible();
  await expect(page.locator(".tiptap")).toContainText("Reviewed Nguyễn Dữ");
  await expect(
    page.getByRole("button", { name: "Xuất bản", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "So sánh phiên bản", exact: true })
    .click();
  await page.locator(".version-diff select").selectOption(initial.draft_id);
  await expect(page.locator(".version-diff .diff-removed")).toContainText(
    "Original Nguyễn Dữ",
    { timeout: 30000 },
  );
  await expect(page.locator(".version-diff .diff-added")).toContainText(
    "Reviewed Nguyễn Dữ",
  );
  await page
    .getByRole("button", { name: "Kiểm tra trước xuất bản", exact: true })
    .click();
  await expect(page.locator(".review-issues")).toContainText(
    "Không phát hiện lỗi",
  );
  report.checks.push(
    "Authenticated comparison of saved versions and clean preflight UI",
  );
  phase = "presence";
  let r = await request(other, "presence", {
    lease: randomUUID(),
    chapterId: ids[0],
    locale: "vi",
    leave: false,
  });
  assert.equal(r.status, 200);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".editing-presence")).toContainText(other.email);
  ok(
    await service
      .from("members")
      .update({ active: false })
      .eq("user_id", other.uid),
  );
  r = await request(other, "presence", {
    lease: randomUUID(),
    chapterId: ids[0],
    locale: "vi",
    leave: false,
  });
  assert.equal(r.status, 403);
  r = await request(other, "audit", undefined, "GET");
  assert.equal(r.status, 403);
  report.checks.push(
    "Other editor visible; revocation immediately denies presence/audit",
  );
  phase = "batch UI";
  await page.getByRole("button", { name: "Tìm–thay thế", exact: true }).click();
  await page.getByLabel("Tìm", { exact: true }).fill("Nguyễn Dữ");
  await page.getByLabel("Thay bằng", { exact: true }).fill("Nguyễn Du");
  await page
    .getByRole("button", { name: "Xem trước thay thế", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bỏ chọn tất cả", exact: true }),
  ).toBeVisible({timeout:60000});
  await page
    .getByRole("button", { name: "Bỏ chọn tất cả", exact: true })
    .click();
  await page
    .locator(".replacement-entry")
    .filter({ hasText: "QA " + ids[0] })
    .getByRole("checkbox")
    .check();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Áp dụng thành bản nháp", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã tạo bản nháp thay thế" }),
  ).toBeVisible();
  const changed = ok(
      await service
        .from("chapter_editions")
        .select("*")
        .eq("chapter_id", ids[0])
        .eq("locale", "vi")
        .single(),
    ),
    version = ok(
      await service
        .from("chapter_versions")
        .select("*")
        .eq("id", changed.draft_id)
        .single(),
    );
  assert.equal(changed.published_id, null);
  assert.match(version.html, /Nguyễn Du/);
  assert.equal(version.revision, 3);
  assert.deepEqual(
    ok(await service.from("chapter_editions").select("*")).filter(
      (h) => !ids.includes(h.chapter_id),
    ),
    otherHeads,
  );
  report.checks.push(
    "Selected replacement creates only its new draft; real chapter revisions unchanged",
  );
  phase = "conflict and publication guards";
  r = await request(actor, "replace", {
    locale: "vi",
    find: "Nguyễn",
    replacement: "N",
    caseSensitive: false,
    includeTitles: false,
    items: [
      { id: ids[0], expectedRevision: 3 },
      { id: ids[1], expectedRevision: 0 },
    ],
  });
  assert.equal(r.status, 409);
  assert.equal(
    ok(
      await service
        .from("chapter_editions")
        .select("revision")
        .eq("chapter_id", ids[0])
        .single(),
    ).revision,
    3,
  );
  r = await request(actor, "chapters", {
    id: ids[1],
    locale: "vi",
    title: "QA " + ids[1],
    html: '<p></p><a href="#missing">1</a><img>',
    kind: "text",
    expectedRevision: 1,
  });
  assert.equal(r.status, 200);
  r = await request(actor, "review", {
    items: [{ id: ids[1], locale: "vi", expectedRevision: 2 }],
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.issues.some((i) => i.code === "missing-target"));
  r = await request(actor, "chapters", {
    action: "publish",
    id: ids[1],
    locale: "vi",
    expectedRevision: 2,
  });
  assert.equal(r.status, 422);
  assert.equal(
    ok(
      await service
        .from("chapter_editions")
        .select("published_id")
        .eq("chapter_id", ids[1])
        .single(),
    ).published_id,
    null,
  );
  report.checks.push(
    "Stale batch refuses all writes; broken drafts cannot be published via API",
  );
  phase = "audit UI";
  await page.getByRole("button", { name: "Nhật ký", exact: true }).click();
  await expect(page.locator(".audit-log")).toContainText(actor.email);
  await expect(page.locator(".audit-log")).toContainText("Thay thế hàng loạt");
  assert.ok(
    (await actor.client.from("admin_audit").delete().eq("actor_id", actor.uid))
      .error,
  );
  report.checks.push(
    "Private activity UI records importer/saver/replacement actor; editor cannot delete audit",
  );
  phase = "private asset exclusion";
  const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZcAAAAABJRU5ErkJggg==",
      "base64",
    ),
    path = actor.uid + "/" + randomUUID() + ".png";
  assetPaths.push(path);
  ok(
    await actor.client.storage
      .from("book-assets")
      .upload(path, image, { contentType: "image/png", upsert: false }),
  );
  r = await request(actor, "assets", { path, contentType: "image/png" });
  assert.equal(r.status, 200);
  assert.equal(
    (await fetch(base + "/api/assets/" + path, { redirect: "manual" })).status,
    404,
  );
  await page.goto(base + "/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Tải VI/EN để đọc ngoại tuyến", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Đọc bản đã tải", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  const rejected = await page.evaluate(
    (path) =>
      new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
          if (e.data.error || e.data.ok) {
            resolve(!!e.data.error);
            channel.port1.close();
          }
        };
        navigator.serviceWorker.controller.postMessage(
          {
            type: "prepare-offline",
            cacheName: "tkml-offline-data-" + crypto.randomUUID(),
            urls: ["/api/assets/" + path],
          },
          [channel.port2],
        );
      }),
    path,
  );
  assert.equal(rejected, true);
  report.checks.push(
    "Logged-in editor cannot put an unpublished private asset into offline cache",
  );
  assert.equal(await publicHash(), before);
  report.publicBookUnchanged = true;
} catch (e) {
  const page = browser
    ?.contexts()
    .flatMap((c) => c.pages())
    .at(-1);
  if (page) {
    report.alerts = await page.getByRole("alert").allTextContents();
    await page
      .screenshot({
        path: root + ".impeccable/review/expansion-admin-failure.png",
      })
      .catch(() => {});
  }
  report.failure = {
    phase,
    name: e.name,
    detail: secrets
      .filter(Boolean)
      .reduce(
        (s, secret) => s.replaceAll(secret, "[redacted]"),
        String(e.message),
      )
      .slice(0, 300),
  };
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const actor of actors)
    await clean("presence " + actor.uid, () =>
      service.from("editor_presence").delete().eq("user_id", actor.uid),
    );
  for (const id of ids) {
    await clean("editions " + id, () =>
      service.from("chapter_editions").delete().eq("chapter_id", id),
    );
    await clean("versions " + id, () =>
      service.from("chapter_versions").delete().eq("chapter_id", id),
    );
    await clean("chapter " + id, () =>
      service.from("chapters").delete().eq("id", id),
    );
  }
  for (const path of assetPaths) {
    await clean("storage asset", () =>
      service.storage.from("book-assets").remove([path]),
    );
    await clean("asset record", () =>
      service.from("assets").delete().eq("path", path),
    );
  }
  const entities = [...ids, ...actors.map((a) => a.uid), ...assetPaths];
  for (const actor of actors)
    await clean("verification audit", () =>
      service
        .from("admin_audit")
        .delete()
        .or(`actor_id.eq.${actor.uid},entity_id.in.(${entities.join(",")})`),
    );
  for (const actor of actors) {
    await clean("membership", () =>
      service.from("members").delete().eq("user_id", actor.uid),
    );
    await clean("Auth user", () => service.auth.admin.deleteUser(actor.uid));
  }
  report.success = !report.failure && report.cleanup.every((r) => r.ok);
  if (!report.success) process.exitCode = 1;
  await mkdir(new URL("../verification", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../verification/expansion-admin-latest.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
