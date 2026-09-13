import { getRuntimeEnv } from "@/lib/db-runtime";
import { getReferenceElement } from "@/lib/mp-reference-db";

export const runtime = "edge";

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json(
      { error: "The database binding is not available in this preview." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? url.searchParams.get("element");

  if (!id) {
    return Response.json({ error: "id is required." }, { status: 400 });
  }

  const element = await getReferenceElement(runtimeEnv.DB, id, {
    managementPack: url.searchParams.get("managementPack") ?? undefined,
    version: url.searchParams.get("version") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });

  if (!element) {
    return Response.json({ error: "Element not found." }, { status: 404 });
  }

  return Response.json({ element });
}
