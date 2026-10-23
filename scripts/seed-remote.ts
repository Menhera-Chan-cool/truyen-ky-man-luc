import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure .env.local first.");
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const book = JSON.parse(await readFile("src/data/book.json", "utf8"));
const { error } = await admin.rpc("seed_book", { p_book: book });
if (error) throw new Error(error.message);
console.log(
  "Published 20 Vietnamese chapters, 20 English chapters and the Vietnamese preface in one database transaction. Existing content was not overwritten.",
);
