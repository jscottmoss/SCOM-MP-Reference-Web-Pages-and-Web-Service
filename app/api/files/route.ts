import { getRuntimeEnv, recordImportJob } from "@/lib/db-runtime";
import { saveSourceFileRecord } from "@/lib/mp-reference-db";
import {
  cleanFileName,
  contentTypeForSource,
  extensionFor,
  sha256Hex,
  sourceFileR2Key,
  sourceKindFor,
} from "@/lib/source-file-storage";

export const runtime = "edge";

export async function POST(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB || !runtimeEnv.MP_FILES) {
    return Response.json(
      { error: "The database and source file store must both be available." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const fileName = cleanFileName(file.name);
  const sourceKind = sourceKindFor(fileName);

  if (sourceKind === "unknown") {
    return Response.json(
      { error: "Only XML, CSV, MP, and MPB files are supported." },
      { status: 400 }
    );
  }

  const sourceFileId = crypto.randomUUID();
  const buffer = await file.arrayBuffer();

  if (!buffer.byteLength) {
    return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  const contentType = contentTypeForSource(fileName, file.type || undefined);
  const fileSha256 = await sha256Hex(buffer);
  const r2Key = sourceFileR2Key(sourceFileId, fileName);

  await runtimeEnv.MP_FILES.put(r2Key, buffer, {
    httpMetadata: { contentType },
    customMetadata: {
      sourceFileId,
      sha256: fileSha256,
      originalFileName: fileName,
    },
  });

  await saveSourceFileRecord(runtimeEnv.DB, {
    sourceFileId,
    originalFileName: fileName,
    fileExtension: extensionFor(fileName),
    sourceKind,
    contentType,
    fileSize: buffer.byteLength,
    sha256: fileSha256,
    r2Key,
    processingStatus: "stored",
    processingMessage:
      sourceKind === "csv"
        ? "Original CSV source file stored without management pack parsing."
        : "Original source file stored.",
  });

  await recordImportJob(runtimeEnv.DB, {
    id: sourceFileId,
    fileName,
    fileType: sourceKind,
    status: "stored",
    message: "Original source file stored.",
    r2Key,
  });

  return Response.json({
    sourceFile: {
      sourceFileId,
      originalFileName: fileName,
      fileExtension: extensionFor(fileName),
      sourceKind,
      contentType,
      fileSize: buffer.byteLength,
      sha256: fileSha256,
      downloadUrl: `/api/files/download?sourceFileId=${encodeURIComponent(sourceFileId)}`,
    },
  });
}
