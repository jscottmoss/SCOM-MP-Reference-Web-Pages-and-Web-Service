import { packsToCsv } from "@/lib/csv";
import { getRuntimeEnv, readImportedPacks } from "@/lib/db-runtime";
import { referencePayload } from "@/lib/reference-data";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pack = url.searchParams.get("pack") ?? undefined;
  const section = url.searchParams.get("section") ?? undefined;
  const runtimeEnv = getRuntimeEnv();
  const imported = runtimeEnv.DB ? await readImportedPacks(runtimeEnv.DB) : [];
  const csv = packsToCsv([...imported, ...referencePayload.packs], { pack, section });
  const suffix = [pack ?? "all-management-packs", section].filter(Boolean).join("-");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${suffix}.csv"`,
    },
  });
}
