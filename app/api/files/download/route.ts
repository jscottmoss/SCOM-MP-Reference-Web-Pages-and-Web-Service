import { getRuntimeEnv } from "@/lib/db-runtime";
import { getSourceFileRecord } from "@/lib/mp-reference-db";
import {
  attachmentHeader,
  contentTypeForSource,
} from "@/lib/source-file-storage";

export const runtime = "edge";

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB || !runtimeEnv.MP_FILES) {
    return Response.json(
      { error: "The database and source file store must both be available." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const sourceFileId = url.searchParams.get("sourceFileId") ?? "";

  if (!sourceFileId) {
    return Response.json({ error: "sourceFileId is required." }, { status: 400 });
  }

  const sourceFile = await getSourceFileRecord(runtimeEnv.DB, sourceFileId);

  if (!sourceFile?.r2Key) {
    return Response.json({ error: "Stored source file not found." }, { status: 404 });
  }

  const sourceObject = await runtimeEnv.MP_FILES.get(sourceFile.r2Key);

  if (!sourceObject) {
    return Response.json(
      { error: "The stored source file bytes could not be found." },
      { status: 404 }
    );
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    contentTypeForSource(sourceFile.originalFileName, sourceObject.httpMetadata?.contentType)
  );
  headers.set("content-disposition", attachmentHeader(sourceFile.originalFileName));
  headers.set("etag", sourceObject.httpEtag);
  headers.set("x-file-sha256", sourceFile.sha256);
  headers.set("x-file-size", String(sourceFile.fileSize));

  return new Response(sourceObject.body, { headers });
}
