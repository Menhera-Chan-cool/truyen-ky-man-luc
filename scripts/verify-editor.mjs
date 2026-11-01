import { createRequire } from "node:module";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
require("@next/env").loadEnvConfig(root, false, { info() {}, error() {} });
const { createClient } = require("@supabase/supabase-js"),
  { chromium, webkit, expect } = require("@playwright/test");
const config = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  config,
);
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  config,
);
const tag = randomUUID().slice(0, 8),
  ids = ["preface", "one", "two"].map((s) => "verify-editor-" + tag + "-" + s);
const email = "verify-editor-" + tag + "@example.test",
  password = randomBytes(24).toString("base64url") + "aA1!";
const base =
  process.env.BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";
let uid,
  browser,
  phase = "setup";
const report = { base,engine:process.env.EDITOR_ENGINE??"chromium", checks: [], cleanup: [], networkErrors: [],pageErrors:[] };
function ok(r) {
  if (r.error)
    throw Error("Request failed " + (r.error.code ?? r.error.status ?? ""));
  return r.data;
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
  uid = ok(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  ).user.id;
  ok(
    await admin
      .from("members")
      .insert({ user_id: uid, email, role: "editor", active: true }),
  );
  ok(await client.auth.signInWithPassword({ email, password }));
  for (const id of ids)
    for (const locale of ["vi", "en"])
      ok(
        await client.rpc("save_chapter", {
          p_id: id,
          p_locale: locale,
          p_title: "QA " + id + " " + locale,
          p_html: "<p>ORIGINAL " + id + " " + locale + "</p>",
          p_kind: "text",
          p_pdf_path: null,
          p_expected_revision: 0,
        }),
      );
  browser = await (process.env.EDITOR_ENGINE==="webkit"?webkit:chromium).launch();
  for (const locale of ["vi", "en"]) {
    phase = "open " + locale;
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror",e=>report.pageErrors.push(e.message.replace(/https?:\/\/\S+/g,"[url]").replaceAll(password,"[redacted]")));
    page.on("requestfailed", (request) =>
      report.networkErrors.push({
        path: new URL(request.url()).pathname,
        failure: request.failure()?.errorText,
      }),
    );
    page.on("response", (response) => {
      if (response.status() >= 400)
        report.networkErrors.push({
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
    page.on("dialog", (d) => d.dismiss());
    const statePayloads = [];
    page.on("response", async (response) => {
      if (
        new URL(response.url()).pathname === "/api/admin/state" &&
        response.ok()
      ) {
        const state = await response.json();
        statePayloads.push(state);
      }
    });
    await page.goto(base + "/admin?lang=" + locale);
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page
      .getByRole("button", {
        name: locale === "vi" ? "Đăng nhập" : "Sign in",
        exact: true,
      })
      .click();
    await page.locator(".editor-chapter").first().waitFor({ timeout: 45000 });
    for (const id of ids) {
      phase = "select original " + locale + " " + id;
      await page
        .locator(".editor-chapter")
        .filter({ hasText: id })
        .locator("button")
        .first()
        .click();
      await page.waitForFunction(
        (id) =>
          document.querySelector('.editor-surface input[maxlength="300"]')
            ?.value ===
          "QA " + id + " " + document.documentElement.lang,
        id,
      );
      await page.locator(".tiptap").waitFor();
      assert.equal(
        (await page.locator(".tiptap").innerText()).includes(
          "ORIGINAL " + id + " " + locale,
        ),
        true,
      );
      phase = "paste and save " + locale + " " + id;
      const marker = "PASTED " + locale + " " + id;
      await page.locator(".tiptap").click();
      await page.locator(".tiptap").press("ControlOrMeta+A");
      await page.locator(".tiptap").evaluate((el, marker) => {
        const dt = new DataTransfer();
        dt.setData("text/plain", marker);
        dt.setData("text/html", "<p><strong>" + marker + "</strong></p>");
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, marker);
      assert.equal((await page.locator(".tiptap").innerText()).trim(), marker);
      let writes=0,lost=false;
      if(id===ids[0])await page.route("**/api/admin/chapters",async route=>{
        writes++;const response=await route.fetch();if(response.ok()){lost=true;await route.abort();}else await route.fulfill({response});
      });
      await page
        .getByRole("button", {
          name: locale === "vi" ? "Lưu bản nháp" : "Save draft",
          exact: true,
        })
        .click();
      await page
        .getByRole("status")
        .filter({
          hasText: locale === "vi" ? "Đã lưu bản nháp" : "Draft saved",
        })
        .waitFor({ timeout: 45000 });
      if(id===ids[0]){await page.unroute("**/api/admin/chapters");assert(lost&&writes===1);report.checks.push(locale+" committed save recovered after lost response without retry");}
    }
    if(locale==="vi"){
      phase="confirmed write but refresh hangs";
      await page.locator(".tiptap").fill("PASTED "+locale+" "+ids[2]);
      let held,release;await page.route("**/api/admin/state",async route=>{held=route;await new Promise(resolve=>{release=resolve;});});
      await page.getByRole("button",{name:"Lưu bản nháp",exact:true}).click();
      await expect(page.getByRole("alert").filter({hasText:"Server đã xác nhận"})).toBeVisible({timeout:20000});
      await expect(page.locator(".tiptap")).toContainText("PASTED "+locale+" "+ids[2]);
      await held?.abort().catch(()=>{});release?.();await page.unroute("**/api/admin/state");
      page.removeAllListeners("dialog");page.on("dialog",d=>d.accept());await page.reload();await page.locator(".editor-chapter").first().waitFor();page.removeAllListeners("dialog");page.on("dialog",d=>d.dismiss());
      report.checks.push("confirmed write with failed refresh keeps editor content and explains server outcome");
    }
    for (const id of ids) {
      phase = "verify saved " + locale + " " + id;
      await page
        .locator(".editor-chapter")
        .filter({ hasText: id })
        .locator("button")
        .first()
        .click();
      await page.waitForFunction(
        (marker) =>
          document.querySelector(".tiptap")?.textContent?.trim() === marker,
        "PASTED " + locale + " " + id,
      );
      assert.equal(
        (await page.locator(".tiptap").innerText()).trim(),
        "PASTED " + locale + " " + id,
      );
    }
    await page.reload();
    await page.locator(".editor-chapter").first().waitFor({ timeout: 45000 });
    for (const id of ids) {
      const edition = ok(
        await admin
          .from("chapter_editions")
          .select("draft_id,published_id")
          .eq("chapter_id", id)
          .eq("locale", locale)
          .single(),
      );
      const version = ok(
        await admin
          .from("chapter_versions")
          .select("html")
          .eq("id", edition.draft_id)
          .single(),
      );
      assert.equal(version.html.includes("PASTED " + locale + " " + id), true);
      assert.equal(edition.published_id, null);
    }
    assert(statePayloads.length > 0);
    assert(
      statePayloads.every((s) =>
        s.versions.every((v) => !Object.hasOwn(v, "html")),
      ),
    );
    let delayed = false;
    await page.route("**/api/admin/chapters?*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.searchParams.get("id") === ids[0] &&
        url.searchParams.has("version")
      ) {
        delayed = true;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.continue().catch(() => {});
    });
    await page
      .locator(".editor-chapter")
      .filter({ hasText: ids[0] })
      .locator("button")
      .first()
      .click();
    for (let attempt = 0; attempt < 50 && !delayed; attempt++)
      await page.waitForTimeout(20);
    assert.equal(delayed, true);
    await page
      .locator(".editor-chapter")
      .filter({ hasText: ids[1] })
      .locator("button")
      .first()
      .click();
    await page.waitForFunction(
      (marker) =>
        document.querySelector(".tiptap")?.textContent?.trim() === marker,
      "PASTED " + locale + " " + ids[1],
    );
    await page.waitForTimeout(900);
    assert.equal(
      (await page.locator(".tiptap").innerText()).trim(),
      "PASTED " + locale + " " + ids[1],
    );
    await page.unroute("**/api/admin/chapters?*");
    phase="hung chapter read "+locale;
    let held,release;
    await page.route("**/api/admin/chapters?*",async route=>{
      if(new URL(route.request().url()).searchParams.get("id")===ids[0]){held=route;await new Promise(resolve=>{release=resolve;});}
      else await route.continue();
    });
    await page.locator(".editor-chapter").filter({hasText:ids[0]}).locator("button").first().click();
    await expect(page.locator(".empty-admin").getByRole("alert")).toContainText(/timed out|hết thời gian/i,{timeout:20000});
    await held?.abort().catch(()=>{});release?.();await page.unroute("**/api/admin/chapters?*");
    await page.getByRole("button",{name:locale==="vi"?"Thử lại":"Retry",exact:true}).click();
    await expect(page.locator(".tiptap")).toContainText("PASTED "+locale+" "+ids[0]);
    report.checks.push(locale+" hung chapter read ends with retry; correct content reopens");

    await page
      .getByRole("button", {
        name: locale === "vi" ? "Nhập file" : "Import files",
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", {
        name: locale === "vi" ? "Nhập nội dung sách" : "Import book content",
        exact: true,
      })
      .waitFor();
    phase = "import lock " + locale;
    await page.locator("input[type=file][multiple]").setInputFiles({
      name: "QA.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("QA import\n\nPrivate synthetic content."),
    });
    await page
      .getByRole("combobox", {
        name: locale === "vi" ? "Ghép chương" : "Map chapter",
        exact: true,
      })
      .selectOption(ids[0]);
    await page
      .getByRole("checkbox", {
        name:
          locale === "vi"
            ? "Tôi xác nhận thay thế các chương được ghép vào nội dung hiện có."
            : "I confirm replacing selected chapters mapped to existing content.",
        exact: true,
      })
      .check();
    let attempt = 0;
    await page.route("**/storage/v1/object/book-sources/**", (route) =>
      route.fulfill({ status: 200, json: { Key: "QA/mock.txt" } }),
    );
    await page.route("**/api/admin/chapters", async (route) => {
      const body = route.request().postDataJSON();
      assert.equal(body.action, "import");
      assert(
        body.items.length > 0 &&
          body.items.every(
            (item) => item.id === ids[0] && item.locale === locale,
          ),
      );
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 700));
      if(attempt===1)await route.fulfill({status:409,json:{error:"QA controlled conflict"}});
      else{const response=await route.fetch();assert(response.ok());await route.abort();}
    });
    const saveImport = page.getByRole("button", {
      name:
        locale === "vi"
          ? "Lưu các phần đã chọn thành bản nháp"
          : "Save selected sections as drafts",
      exact: true,
    });
    const assertLocked = async () => {
      await expect(page.locator(".admin-content")).toHaveAttribute("inert", "");
      for (const button of await page.locator(".admin-tabs button").all())
        await expect(button).toBeDisabled();
      for (const link of await page
        .locator(".admin-header .language-switch a")
        .all())
        await expect(link).toHaveAttribute("aria-disabled", "true");
    };
    await saveImport.click();
    await assertLocked();
    await expect(page.locator(".admin-content")).not.toHaveAttribute(
      "inert",
      "",
      { timeout: 30000 },
    );
    await expect(
      page.getByRole("combobox", {
        name: locale === "vi" ? "Ghép chương" : "Map chapter",
        exact: true,
      }),
    ).toHaveValue(ids[0]);
    const chaptersTab = page.getByRole("button", {
      name: locale === "vi" ? "Chương & minh họa" : "Chapters & illustrations",
      exact: true,
    });
    await chaptersTab.click();
    await expect(
      page.getByRole("heading", {
        name: locale === "vi" ? "Nhập nội dung sách" : "Import book content",
        exact: true,
      }),
    ).toBeVisible();
    await saveImport.click();
    await assertLocked();
    await expect(chaptersTab).toBeEnabled({ timeout: 30000 });
    await expect(
      page.getByRole("combobox", {
        name: locale === "vi" ? "Ghép chương" : "Map chapter",
        exact: true,
      }),
    ).toHaveCount(0);
    assert.equal(attempt, 2);
    report.checks.push(locale+" committed import recovered after lost response; candidates retained after conflict");
    await page.unroute("**/api/admin/chapters");
    await page.unroute("**/storage/v1/object/book-sources/**");
    await chaptersTab.click();
    await page
      .locator(".editor-chapter")
      .filter({ hasText: ids[1] })
      .locator("button")
      .first()
      .click();
    await page.waitForFunction(
      (marker) =>
        document.querySelector(".tiptap")?.textContent?.trim() === marker,
      "PASTED " + locale + " " + ids[1],
    );
    phase = "inline image lock " + locale;
    await page.route("**/storage/v1/object/book-assets/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        status: 400,
        json: { message: "QA controlled upload failure" },
      });
    });
    await page.locator(".editor-surface input[type=file]").setInputFiles({
      name: "QA.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6U0AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await assertLocked();
    await expect(
      page.getByRole("button", {
        name: locale === "vi" ? "Lưu bản nháp" : "Save draft",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(chaptersTab).toBeEnabled({ timeout: 30000 });
    await page.unroute("**/storage/v1/object/book-assets/**");
    report.checks.push(
      locale +
        " import and inline-image parent lock; failed import preserves preview/discard warning; retry waits for parent refresh (mocked storage/import boundaries, no uploaded objects)",
    );
    report.checks.push(
      locale +
        " rich paste/save/switch/reload keeps three chapter contents separate; state responses contain no HTML",
    );
    report.checks.push(
      locale +
        " stale chapter request is cancelled; import tool loads on demand",
    );
    await page.close();
  }
} catch (e) {
  const page = browser
    ?.contexts()
    .flatMap((c) => c.pages())
    .at(-1);
  report.failure = {
    phase,
    name: e.name,
    surface: page ? (await page.locator("body").innerText()).slice(0, 400) : "",
    alerts: page ? await page.getByRole("alert").allTextContents() : [],
    detail: String(e.message).replaceAll(password, "[redacted]").slice(0, 200),
  };
  if (page)
    await page
      .screenshot({ path: root + ".impeccable/review/editor-last-failure.png" })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (uid) {
    await clean("editing presence", () =>
      admin.from("editor_presence").delete().eq("user_id", uid),
    );
    for (const id of ids) {
      await clean("edition " + id, () =>
        admin.from("chapter_editions").delete().eq("chapter_id", id),
      );
      await clean("versions " + id, () =>
        admin.from("chapter_versions").delete().eq("chapter_id", id),
      );
      await clean("chapter " + id, () =>
        admin.from("chapters").delete().eq("id", id),
      );
    }
    await clean("verification audit", () =>
      admin
        .from("admin_audit")
        .delete()
        .or(`actor_id.eq.${uid},entity_id.in.(${[uid, ...ids].join(",")})`),
    );
    await clean("membership", () =>
      admin.from("members").delete().eq("user_id", uid),
    );
    await clean("Auth user", () => admin.auth.admin.deleteUser(uid));
  }
  report.success = !report.failure && report.cleanup.every((x) => x.ok)&&report.pageErrors.length===0;
  if (!report.success) process.exitCode = 1;
  await mkdir(new URL("../verification", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../verification/editor-switch-latest.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(new URL(`../verification/editor-network-${report.engine}-${base.includes("localhost")?"local":"live"}.json`,import.meta.url),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
}
