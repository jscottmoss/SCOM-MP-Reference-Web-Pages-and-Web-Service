import { ensureSchema, getRuntimeEnv } from "@/lib/db-runtime";
import {
  getReferencePack,
  getReferencePackById,
} from "@/lib/mp-reference-db";
import { extractManagementPackXmlFiles } from "@/lib/mp-package-reader";
import { parseManagementPackReferenceXml } from "@/lib/mp-reference-parser";
import {
  attachmentHeader,
  contentTypeForSource,
  extensionFor,
} from "@/lib/source-file-storage";

export const runtime = "edge";

type ImportJobFileRow = {
  file_name: string;
  file_type: string;
};

type DownloadFormat = "xml" | "source" | "mp" | "mpb" | "mbp";

function fileNameFromR2Key(r2Key: string) {
  return r2Key.split("/").filter(Boolean).at(-1) ?? "management-pack-source.bin";
}

function xmlFileName(systemName: string, version: string) {
  return `${systemName}-${version}.xml`;
}

type PackDownloadSource = {
  systemName: string;
  version: string;
  fileName: string;
  r2Key?: string;
  sourceFileName?: string;
  sourceFileExtension?: string;
  sourceFileSize?: number;
  sourceFileSha256?: string;
};

async function sourceFileForPack(
  db: D1Database,
  pack: PackDownloadSource
) {
  if (pack.sourceFileName) {
    return {
      fileName: pack.sourceFileName,
      fileType: pack.sourceFileExtension || extensionFor(pack.sourceFileName),
      fileSize: pack.sourceFileSize,
      sha256: pack.sourceFileSha256,
    };
  }

  await ensureSchema(db);

  try {
    const row = await db
      .prepare(`SELECT file_name, file_type
        FROM import_jobs
        WHERE r2_key = ?
        ORDER BY created_at DESC
        LIMIT 1`)
      .bind(pack.r2Key ?? "")
      .first<ImportJobFileRow>();

    if (row?.file_name) {
      return {
        fileName: row.file_name,
        fileType: row.file_type,
      };
    }
  } catch {
    // Older local databases may not have import job rows for every pack.
  }

  const fallbackFileName = pack.fileName || xmlFileName(pack.systemName, pack.version);
  const keyFileName = pack.r2Key ? fileNameFromR2Key(pack.r2Key) : "";

  return {
    fileName: keyFileName || fallbackFileName,
    fileType: extensionFor(keyFileName || fallbackFileName),
  };
}

async function packFromRequest(db: D1Database, url: URL) {
  const idValue = Number(url.searchParams.get("managementPackId") ?? "");

  if (Number.isInteger(idValue) && idValue > 0) {
    return getReferencePackById(db, idValue);
  }

  const managementPack = url.searchParams.get("managementPack");
  const version = url.searchParams.get("version") ?? undefined;

  if (!managementPack) {
    throw new Response(
      JSON.stringify({ error: "managementPack or managementPackId is required." }),
      {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }

  return getReferencePack(db, managementPack, version);
}

async function selectedXmlFromSource(
  sourceBytes: ArrayBuffer,
  sourceFileName: string,
  systemName: string,
  version: string
) {
  const extractedPacks = await extractManagementPackXmlFiles(sourceBytes, sourceFileName);

  for (const extractedPack of extractedPacks) {
    try {
      const candidate = parseManagementPackReferenceXml(
        extractedPack.xmlText,
        extractedPack.fileName,
        extractedPack.sourceKind
      );

      if (candidate.systemName === systemName && candidate.version === version) {
        return extractedPack.xmlText;
      }
    } catch {
      // Keep scanning the rest of the source bundle.
    }
  }

  if (extractedPacks.length === 1) {
    return extractedPacks[0].xmlText;
  }

  return null;
}

function normalizeFormat(value: string | null): DownloadFormat | null {
  const normalized = (value || "xml").toLowerCase();

  if (
    normalized === "xml" ||
    normalized === "source" ||
    normalized === "original" ||
    normalized === "mp" ||
    normalized === "mpb" ||
    normalized === "mbp"
  ) {
    return normalized === "original" ? "source" : normalized;
  }

  return null;
}

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json(
      { error: "The database binding is not available in this preview." },
      { status: 503 }
    );
  }

  if (!runtimeEnv.MP_FILES) {
    return Response.json(
      { error: "The management pack file store is not available in this preview." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const format = normalizeFormat(url.searchParams.get("format"));

  if (!format) {
    return Response.json(
      { error: "format must be xml, source, mp, mpb, or mbp." },
      { status: 400 }
    );
  }

  let pack;

  try {
    pack = await packFromRequest(runtimeEnv.DB, url);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }

  if (!pack) {
    return Response.json({ error: "Management pack not found." }, { status: 404 });
  }

  if (!pack.r2Key) {
    return Response.json(
      { error: "This imported management pack does not have a stored source file." },
      { status: 404 }
    );
  }

  const source = await sourceFileForPack(runtimeEnv.DB, pack);
  const sourceExtension = source.fileType || extensionFor(source.fileName);
  const sourceObject = await runtimeEnv.MP_FILES.get(pack.r2Key);

  if (!sourceObject) {
    return Response.json(
      { error: "The stored source file could not be found." },
      { status: 404 }
    );
  }

  if (format === "source" || format === "mp" || format === "mpb" || format === "mbp") {
    const requestedSourceExtension = format === "source" ? sourceExtension : format;
    const sourceMatchesRequest =
      format === "source" ||
      requestedSourceExtension === sourceExtension ||
      (format === "mpb" && sourceExtension === "mbp") ||
      (format === "mbp" && sourceExtension === "mpb");

    if (!sourceMatchesRequest) {
      return Response.json(
        {
          error: `The stored source file is a ${sourceExtension.toUpperCase() || "source"} file, not ${format.toUpperCase()}.`,
        },
        { status: 400 }
      );
    }

    const headers = new Headers();
    headers.set(
      "content-type",
      contentTypeForSource(source.fileName, sourceObject.httpMetadata?.contentType)
    );
    headers.set("content-disposition", attachmentHeader(source.fileName));
    headers.set("etag", sourceObject.httpEtag);
    if (source.sha256) {
      headers.set("x-file-sha256", source.sha256);
    }
    if (source.fileSize !== undefined) {
      headers.set("x-file-size", String(source.fileSize));
    }

    return new Response(sourceObject.body, { headers });
  }

  const sourceBytes = await sourceObject.arrayBuffer();
  const xmlText = await selectedXmlFromSource(
    sourceBytes,
    source.fileName,
    pack.systemName,
    pack.version
  );

  if (!xmlText) {
    return Response.json(
      { error: "The selected management pack XML could not be found in the stored source file." },
      { status: 404 }
    );
  }

  return new Response(xmlText, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": attachmentHeader(
        xmlFileName(pack.systemName, pack.version)
      ),
    },
  });
}
