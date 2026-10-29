import { requireEditor, jsonBody, apiError } from "../../../../src/lib/server";
import { reviewPublication } from "../../../../src/lib/publication-review";
export async function POST(request: Request) {
  try {
    const { client } = await requireEditor(request),
      body = await jsonBody(request);
    return Response.json(
      { issues: await reviewPublication(client, body.items) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
