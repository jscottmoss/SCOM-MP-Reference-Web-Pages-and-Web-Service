import {
  getRuntimeEnv,
  recordImportJob,
  saveImportedPack,
} from "@/lib/db-runtime";
import { extractManagementPackXmlFiles } from "@/lib/mp-package-reader";
import { parseManagementPackXml } from "@/lib/mp-xml-parser";
import {
  saveReferencePack,
  saveSourceFileRecord,
  updateSourceFileRecord,
} from "@/lib/mp-reference-db";
import { parseManagementPackReferenceXml } from "@/lib/mp-reference-parser";
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
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const fileName = cleanFileName(file.name);
  const kind = sourceKindFor(fileName);

  if (kind === "unknown" || kind === "csv") {
    return Response.json(
      {
        error:
          kind === "csv"
            ? "CSV files can be stored through /api/files, but only XML, MP, and MPB files can be imported as management packs."
            : "Only XML, MP, and MPB files are supported.",
      },
      { status: 400 }
    );
  }

  const runtimeEnv = getRuntimeEnv();
  const id = crypto.randomUUID();
  const sourceFileId = id;
  const buffer = await file.arrayBuffer();

  if (!buffer.byteLength) {
    return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  const contentType = contentTypeForSource(fileName, file.type || undefined);
  const fileExtension = extensionFor(fileName);
  const fileSha256 = await sha256Hex(buffer);
  const r2Key = runtimeEnv.MP_FILES
    ? sourceFileR2Key(sourceFileId, fileName)
    : null;

  if (runtimeEnv.MP_FILES && r2Key) {
    await runtimeEnv.MP_FILES.put(r2Key, buffer, {
      httpMetadata: { contentType },
      customMetadata: {
        sourceFileId,
        sha256: fileSha256,
        originalFileName: fileName,
      },
    });
  }

  if (runtimeEnv.DB) {
    await saveSourceFileRecord(runtimeEnv.DB, {
      sourceFileId,
      originalFileName: fileName,
      fileExtension,
      sourceKind: kind,
      contentType,
      fileSize: buffer.byteLength,
      sha256: fileSha256,
      r2Key,
      processingStatus: "uploaded",
      processingMessage: "Original source file stored.",
    });
  }

  let extractedPacks;

  try {
    extractedPacks = await extractManagementPackXmlFiles(buffer, fileName);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The management pack file could not be extracted.";

    if (runtimeEnv.DB) {
      await updateSourceFileRecord(runtimeEnv.DB, sourceFileId, {
        processingStatus: "failed",
        processingMessage: message,
        extractedPackCount: 0,
      });
      await recordImportJob(runtimeEnv.DB, {
        id,
        fileName,
        fileType: kind,
        status: "failed",
        message,
        r2Key,
      });
    }

    return Response.json({ error: message }, { status: 400 });
  }

  const importedPacks = extractedPacks.map((extractedPack) => {
    const pack = parseManagementPackXml(
      extractedPack.xmlText,
      extractedPack.fileName,
      extractedPack.sourceKind
    );
    const referencePack = parseManagementPackReferenceXml(
      extractedPack.xmlText,
      extractedPack.fileName,
      extractedPack.sourceKind
    );

    return { pack, referencePack };
  });

  const firstImport = importedPacks[0];
  const totalReferenceElements = importedPacks.reduce(
    (total, importedPack) => total + importedPack.referencePack.elements.length,
    0
  );
  const message =
    importedPacks.length === 1
      ? `${firstImport.pack.systemName} ${firstImport.pack.version} was imported with ${firstImport.referencePack.elements.length} reference elements.`
      : `${fileName} was imported with ${importedPacks.length} management packs and ${totalReferenceElements} reference elements.`;

  if (runtimeEnv.DB) {
    for (const importedPack of importedPacks) {
      await saveImportedPack(
        runtimeEnv.DB,
        importedPack.pack,
        r2Key
      );
      await saveReferencePack(
        runtimeEnv.DB,
        importedPack.referencePack,
        { r2Key, sourceFileId }
      );
    }

    await updateSourceFileRecord(runtimeEnv.DB, sourceFileId, {
      processingStatus: "completed",
      processingMessage: message,
      extractedPackCount: importedPacks.length,
    });

    await recordImportJob(runtimeEnv.DB, {
      id,
      fileName,
      fileType: kind,
      status: "completed",
      message,
      r2Key,
    });
  }

  return Response.json({
    message: runtimeEnv.DB
      ? message
      : `${message} The database binding is not available in this preview, so the import was not persisted.`,
    pack: firstImport.pack,
    packs: importedPacks.map((importedPack) => importedPack.pack),
    referencePack: {
      systemName: firstImport.referencePack.systemName,
      version: firstImport.referencePack.version,
      elementTypeCounts: firstImport.referencePack.elementTypeCounts,
      sectionCounts: firstImport.referencePack.sectionCounts,
    },
    sourceFile: {
      sourceFileId,
      originalFileName: fileName,
      fileExtension,
      fileSize: buffer.byteLength,
      sha256: fileSha256,
      r2Key,
      status: runtimeEnv.DB ? "completed" : "not persisted",
    },
    referencePacks: importedPacks.map((importedPack) => ({
      systemName: importedPack.referencePack.systemName,
      version: importedPack.referencePack.version,
      elementTypeCounts: importedPack.referencePack.elementTypeCounts,
      sectionCounts: importedPack.referencePack.sectionCounts,
    })),
  });
}
