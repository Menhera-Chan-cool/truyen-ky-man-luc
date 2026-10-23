import {
  requireEditor,
  serviceClient,
  apiError,
  jsonBody,
  HttpError,
} from "../../../../src/lib/server";
export async function GET(request: Request) {
  try {
    const { client } = await requireEditor(request, true);
    const { data, error } = await client
      .from("members")
      .select("*")
      .order("created_at");
    if (error) throw new Error(error.message);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await requireEditor(request, true);
    const body = await jsonBody(request);
    if (body.action === "revoke") {
      const { error } = await client
        .from("members")
        .update({ active: false })
        .eq("user_id", body.userId);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new HttpError("Invalid email");
    const admin = serviceClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site)
      throw new HttpError("Set NEXT_PUBLIC_SITE_URL before inviting editors");
    const { data: existing } = await admin
      .from("members")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    const { data, error } = await admin.auth.admin.generateLink({
      type: existing ? "recovery" : "invite",
      email,
      options: { redirectTo: `${site.replace(/\/$/, "")}/admin/activate` },
    });
    if (error || !data.user || !data.properties)
      throw new Error(error?.message ?? "Unable to create invitation");
    const { error: memberError } = await admin.from("members").upsert(
      {
        user_id: data.user.id,
        email,
        role: existing?.role ?? "editor",
        active: true,
      },
      { onConflict: "user_id" },
    );
    if (memberError) throw new Error(memberError.message);
    // This generates a one-time link; it never sends email on the owner's behalf.
    const link = new URL("/auth/confirm", site);
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", existing ? "recovery" : "invite");
    link.searchParams.set("lang", body.locale === "en" ? "en" : "vi");
    return Response.json(
      { link: link.toString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
