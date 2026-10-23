import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("Usage: npm run setup:owner -- your-email@example.com");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  site = process.env.NEXT_PUBLIC_SITE_URL;
if (!url || !key || !site)
  throw new Error(
    "Configure .env.local first. Never paste secret keys into chat.",
  );
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: existing, error: queryError } = await admin
  .from("members")
  .select("*")
  .eq("email", email)
  .maybeSingle();
if (queryError)
  throw new Error("Run the SQL migration before setting up the owner.");
const type = existing ? "recovery" : "invite";
const { data, error } = await admin.auth.admin.generateLink({ type, email });
if (error || !data.user || !data.properties)
  throw new Error(error?.message ?? "Unable to create owner");
const { error: memberError } = await admin
  .from("members")
  .upsert(
    { user_id: data.user.id, email, role: "owner", active: true },
    { onConflict: "user_id" },
  );
if (memberError) throw new Error(memberError.message);
const link = new URL("/auth/confirm", site);
link.searchParams.set("token_hash", data.properties.hashed_token);
link.searchParams.set("type", type);
await writeFile(".owner-invitation.txt", link.toString() + "\n", {
  mode: 0o600,
});
console.log(
  "Owner configured. Open the private .owner-invitation.txt link in your browser, set a password, then delete that file. No email was sent.",
);
