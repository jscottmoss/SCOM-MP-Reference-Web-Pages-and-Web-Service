import { getRuntimeEnv } from "@/lib/db-runtime";
import { getReferencePack, listReferencePacks } from "@/lib/mp-reference-db";

export const runtime = "edge";

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json(
      {
        packs: [],
        message: "The database binding is not available in this preview.",
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const managementPack = url.searchParams.get("managementPack") ?? undefined;
  const version = url.searchParams.get("version") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;

  if (managementPack) {
    const pack = await getReferencePack(runtimeEnv.DB, managementPack, version);

    if (!pack) {
      return Response.json({ error: "Management pack not found." }, { status: 404 });
    }

    return Response.json({ pack });
  }

  const packs = await listReferencePacks(runtimeEnv.DB, { category, version });
  return Response.json({ packs });
}
