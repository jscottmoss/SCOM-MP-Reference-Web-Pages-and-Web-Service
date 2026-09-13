import {
  getRuntimeEnv,
  recordImportJob,
  saveImportedPack,
} from "@/lib/db-runtime";
import {
  createCompiledPackPlaceholder,
  parseManagementPackXml,
} from "@/lib/mp-xml-parser";
import { saveReferencePack } from "@/lib/mp-reference-db";
import { parseManagementPackReferenceXml } from "@/lib/mp-reference-parser";

export const runtime = "edge";

function fileKind(fileName: string) {
  if (/\.xml$/i.test(fileName)) {
    return "xml";
  }

  if (/\.(mp|mpb)$/i.test(fileName)) {
    return "compiled";
  }

  return "unknown";
}

function decodeManagementPackText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }

  return new TextDecoder("utf-8").decode(buffer);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const kind = fileKind(file.name);

  if (kind === "unknown") {
    return Response.json(
      { error: "Only XML, MP, and MPB files are supported." },
      { status: 400 }
    );
  }

  const runtimeEnv = getRuntimeEnv();
  const id = crypto.randomUUID();
  const r2Key = `imports/${id}/${file.name}`;
  const buffer = await file.arrayBuffer();

  if (runtimeEnv.MP_FILES) {
    await runtimeEnv.MP_FILES.put(r2Key, buffer, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
  }

  const xmlText = kind === "xml" ? decodeManagementPackText(buffer) : "";
  const pack =
    kind === "xml"
      ? parseManagementPackXml(xmlText, file.name)
      : createCompiledPackPlaceholder(file.name);
  const referencePack =
    kind === "xml" ? parseManagementPackReferenceXml(xmlText, file.name) : null;

  const message =
    kind === "xml"
      ? `${pack.systemName} ${pack.version} was imported with ${referencePack?.elements.length ?? pack.elements.length} reference elements.`
      : `${file.name} was stored as a compiled management pack package.`;

  if (runtimeEnv.DB) {
    await saveImportedPack(runtimeEnv.DB, pack, runtimeEnv.MP_FILES ? r2Key : null);

    if (referencePack) {
      await saveReferencePack(
        runtimeEnv.DB,
        referencePack,
        runtimeEnv.MP_FILES ? r2Key : null
      );
    }

    await recordImportJob(runtimeEnv.DB, {
      id,
      fileName: file.name,
      fileType: kind,
      status: "completed",
      message,
      r2Key: runtimeEnv.MP_FILES ? r2Key : null,
    });
  }

  return Response.json({
    message: runtimeEnv.DB
      ? message
      : `${message} The database binding is not available in this preview, so the import was not persisted.`,
    pack,
    referencePack: referencePack
      ? {
          systemName: referencePack.systemName,
          version: referencePack.version,
          elementTypeCounts: referencePack.elementTypeCounts,
          sectionCounts: referencePack.sectionCounts,
        }
      : null,
  });
}
