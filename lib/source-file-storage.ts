export type StoredSourceKind = "xml" | "compiled" | "csv";

export function cleanFileName(value: string) {
  const fileNameOnly = value.split(/[\\/]/).filter(Boolean).at(-1) ?? value;
  const cleaned = fileNameOnly
    .replace(/[\\/:*?"<>|\r\n]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "management-pack-source.bin";
}

export function extensionFor(fileName: string) {
  return cleanFileName(fileName).match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
}

export function sourceKindFor(fileName: string): StoredSourceKind | "unknown" {
  const extension = extensionFor(fileName);

  if (extension === "xml") {
    return "xml";
  }

  if (extension === "mp" || extension === "mpb" || extension === "mbp") {
    return "compiled";
  }

  if (extension === "csv") {
    return "csv";
  }

  return "unknown";
}

export function contentTypeForSource(fileName: string, fallback?: string) {
  const extension = extensionFor(fileName);

  if (extension === "xml") {
    return "application/xml; charset=utf-8";
  }

  if (extension === "csv") {
    return "text/csv; charset=utf-8";
  }

  return fallback || "application/octet-stream";
}

export async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function sourceFileR2Key(sourceFileId: string, fileName: string) {
  return `source-files/${sourceFileId}/${cleanFileName(fileName)}`;
}

export function attachmentHeader(fileName: string) {
  const safeName = cleanFileName(fileName);
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(
    safeName
  )}`;
}
