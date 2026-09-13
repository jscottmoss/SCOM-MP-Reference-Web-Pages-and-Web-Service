import { getRuntimeEnv } from "@/lib/db-runtime";
import { listElementTypes } from "@/lib/mp-reference-db";

export const runtime = "edge";

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json(
      {
        types: [],
        message: "The database binding is not available in this preview.",
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const types = await listElementTypes(runtimeEnv.DB, {
    managementPack: url.searchParams.get("managementPack") ?? undefined,
    version: url.searchParams.get("version") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
  });

  return Response.json({ types });
}
