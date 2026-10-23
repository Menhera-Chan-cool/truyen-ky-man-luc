import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";

test("database routines always scope UPDATE statements for Supabase safe-update mode", async () => {
  const sql = await readFile("supabase/migrations/001_book.sql", "utf8");
  const updates = sql.match(/\bupdate\s+public\.\w+\s+set\b[^;]*;/gi) ?? [];
  expect(updates.length).toBeGreaterThan(0);
  for (const update of updates) expect(update).toMatch(/\bwhere\b/i);
});
