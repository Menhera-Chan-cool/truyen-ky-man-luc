import { test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

for (const [script, expected] of [
  ["setup-owner.ts", "Usage: npm run setup:owner"],
  ["seed-remote.ts", "Configure .env.local first."],
]) {
  test(`${script} loads environment support and refuses missing configuration`, () => {
    const cwd = mkdtempSync(join(tmpdir(), "book-admin-script-"));
    const root = fileURLToPath(new URL("../", import.meta.url));
    const env = { ...process.env };
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SITE_URL",
    ])
      delete env[name];
    try {
      const result = spawnSync(
        process.execPath,
        [
          join(root, "node_modules/tsx/dist/cli.mjs"),
          join(root, "scripts", script),
        ],
        { cwd, env, encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expected);
      expect(result.stderr).not.toContain("does not provide an export");
    } finally {
      rmdirSync(cwd);
    }
  });
}
