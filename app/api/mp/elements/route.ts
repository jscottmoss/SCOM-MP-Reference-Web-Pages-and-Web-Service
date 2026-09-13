import { getRuntimeEnv } from "@/lib/db-runtime";
import { listReferenceElements } from "@/lib/mp-reference-db";

export const runtime = "edge";

function readNumber(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json(
      {
        elements: [],
        message: "The database binding is not available in this preview.",
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const elements = await listReferenceElements(runtimeEnv.DB, {
    managementPack: url.searchParams.get("managementPack") ?? undefined,
    version: url.searchParams.get("version") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    section: url.searchParams.get("section") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
    limit: readNumber(url.searchParams.get("limit"), 250),
    offset: readNumber(url.searchParams.get("offset"), 0),
  });

  return Response.json({ elements });
}
