export type ManagementPackSourceKind = "xml" | "compiled";

export type ExtractedManagementPackXml = {
  fileName: string;
  xmlText: string;
  sourceKind: ManagementPackSourceKind;
};

const gzipHeader = [0x1f, 0x8b, 0x08];
const cabinetHeader = [0x4d, 0x53, 0x43, 0x46];
const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function bytesFrom(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function startsWith(bytes: Uint8Array, header: number[]) {
  return header.every((value, index) => bytes[index] === value);
}

function readUInt16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function extensionFor(fileName: string) {
  return fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
}

function xmlFileNameFor(fileName: string, index = 0) {
  const name = fileName.replace(/\.(xml|mp|mpb|mbp)$/i, "");
  return index ? `${name}-${index + 1}.xml` : `${name}.xml`;
}

export function decodeManagementPackText(input: ArrayBuffer | Uint8Array) {
  const bytes = bytesFrom(input);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  if (bytes[0] === 0x3c && bytes[1] === 0x00) {
    return new TextDecoder("utf-16le").decode(bytes);
  }

  if (bytes[0] === 0x00 && bytes[1] === 0x3c) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  return new TextDecoder("utf-8").decode(bytes);
}

function looksLikeManagementPackXml(text: string) {
  return /<ManagementPack\b/i.test(text);
}

async function decompressGzip(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This runtime does not include gzip extraction support for sealed management packs."
    );
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractGzipXmlPayloads(bytes: Uint8Array, fileName: string) {
  const results: ExtractedManagementPackXml[] = [];
  const seen = new Set<string>();

  for (let offset = 5; offset < bytes.length - gzipHeader.length; offset += 1) {
    if (
      bytes[offset] !== gzipHeader[0] ||
      bytes[offset + 1] !== gzipHeader[1] ||
      bytes[offset + 2] !== gzipHeader[2]
    ) {
      continue;
    }

    const resourceType = bytes[offset - 5];
    const compressedLength = readUInt32LE(bytes, offset - 4);
    const hasResourceByteArrayPrefix =
      resourceType === 0x20 &&
      compressedLength > gzipHeader.length &&
      offset + compressedLength <= bytes.length;

    const candidates = hasResourceByteArrayPrefix
      ? [bytes.subarray(offset, offset + compressedLength)]
      : [bytes.subarray(offset)];

    for (const candidate of candidates) {
      try {
        const decompressed = await decompressGzip(candidate);
        const xmlText = decodeManagementPackText(decompressed);

        if (!looksLikeManagementPackXml(xmlText) || seen.has(xmlText)) {
          continue;
        }

        seen.add(xmlText);
        results.push({
          fileName: xmlFileNameFor(fileName, results.length),
          xmlText,
          sourceKind: "compiled",
        });
      } catch {
        // Keep scanning; sealed MPs can contain other gzip-shaped bytes.
      }
    }
  }

  return results;
}

function indexOfBytes(bytes: Uint8Array, pattern: Uint8Array, start = 0) {
  for (let index = start; index <= bytes.length - pattern.length; index += 1) {
    let found = true;

    for (let patternIndex = 0; patternIndex < pattern.length; patternIndex += 1) {
      if (bytes[index + patternIndex] !== pattern[patternIndex]) {
        found = false;
        break;
      }
    }

    if (found) {
      return index;
    }
  }

  return -1;
}

function utf16LeBytes(value: string) {
  const bytes = new Uint8Array(value.length * 2);

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes[index * 2] = code & 0xff;
    bytes[index * 2 + 1] = code >> 8;
  }

  return bytes;
}

function extractRawXmlPayloads(bytes: Uint8Array, fileName: string) {
  const results: ExtractedManagementPackXml[] = [];
  const seen = new Set<string>();
  const patterns = [
    {
      open: new TextEncoder().encode("<ManagementPack"),
      close: new TextEncoder().encode("</ManagementPack>"),
    },
    {
      open: utf16LeBytes("<ManagementPack"),
      close: utf16LeBytes("</ManagementPack>"),
    },
  ];

  for (const pattern of patterns) {
    let start = indexOfBytes(bytes, pattern.open);

    while (start >= 0) {
      const end = indexOfBytes(bytes, pattern.close, start);

      if (end < 0) {
        break;
      }

      const xmlBytes = bytes.subarray(start, end + pattern.close.length);
      const xmlText = decodeManagementPackText(xmlBytes);

      if (looksLikeManagementPackXml(xmlText) && !seen.has(xmlText)) {
        seen.add(xmlText);
        results.push({
          fileName: xmlFileNameFor(fileName, results.length),
          xmlText,
          sourceKind: "compiled",
        });
      }

      start = indexOfBytes(bytes, pattern.open, end + pattern.close.length);
    }
  }

  return results;
}

function compressionName(cabinetBytes: Uint8Array, cabinetOffset: number) {
  if (cabinetOffset < 0 || cabinetOffset + 44 > cabinetBytes.length) {
    return "unknown";
  }

  const flags = readUInt16LE(cabinetBytes, cabinetOffset + 30);
  let folderOffset = cabinetOffset + 36;

  if (flags & 0x0004) {
    const reservedHeaderBytes = readUInt16LE(cabinetBytes, folderOffset);
    folderOffset += 4 + reservedHeaderBytes;
  }

  if (flags & 0x0001) {
    while (folderOffset < cabinetBytes.length && cabinetBytes[folderOffset] !== 0) {
      folderOffset += 1;
    }
    folderOffset += 1;
    while (folderOffset < cabinetBytes.length && cabinetBytes[folderOffset] !== 0) {
      folderOffset += 1;
    }
    folderOffset += 1;
  }

  if (flags & 0x0002) {
    while (folderOffset < cabinetBytes.length && cabinetBytes[folderOffset] !== 0) {
      folderOffset += 1;
    }
    folderOffset += 1;
    while (folderOffset < cabinetBytes.length && cabinetBytes[folderOffset] !== 0) {
      folderOffset += 1;
    }
    folderOffset += 1;
  }

  if (folderOffset + 8 > cabinetBytes.length) {
    return "unknown";
  }

  const compressionType = readUInt16LE(cabinetBytes, folderOffset + 6) & 0x000f;

  switch (compressionType) {
    case 0:
      return "uncompressed CAB";
    case 1:
      return "MSZIP CAB";
    case 2:
      return "Quantum CAB";
    case 3:
      return "LZX CAB";
    default:
      return "unknown CAB";
  }
}

function describeBundle(bytes: Uint8Array) {
  const cabinetOffset = indexOfBytes(bytes, new Uint8Array(cabinetHeader));

  if (cabinetOffset >= 0) {
    return compressionName(bytes, cabinetOffset);
  }

  if (startsWith(bytes, oleHeader)) {
    return "compound storage bundle";
  }

  return "bundle";
}

async function extractCompiledManagementPack(bytes: Uint8Array, fileName: string) {
  const rawXml = extractRawXmlPayloads(bytes, fileName);

  if (rawXml.length) {
    return rawXml;
  }

  const gzipXml = await extractGzipXmlPayloads(bytes, fileName);

  if (gzipXml.length) {
    return gzipXml;
  }

  throw new Error(
    `${fileName} did not contain a readable embedded management pack XML resource.`
  );
}

async function extractManagementPackBundle(bytes: Uint8Array, fileName: string) {
  const rawXml = extractRawXmlPayloads(bytes, fileName);

  if (rawXml.length) {
    return rawXml;
  }

  const gzipXml = await extractGzipXmlPayloads(bytes, fileName);

  if (gzipXml.length) {
    return gzipXml;
  }

  throw new Error(
    `${fileName} is a sealed management pack bundle (${describeBundle(
      bytes
    )}). MPViewer opens this kind of file through the SCOM SDK bundle reader. This web service can import XML and sealed MP files directly; please unpack this MPB to XML first, or import the contained XML/MP files.`
  );
}

export async function extractManagementPackXmlFiles(
  buffer: ArrayBuffer,
  fileName: string
) {
  const bytes = bytesFrom(buffer);
  const extension = extensionFor(fileName);

  if (extension === "xml") {
    const xmlText = decodeManagementPackText(bytes);

    if (!looksLikeManagementPackXml(xmlText)) {
      throw new Error(`${fileName} does not look like a management pack XML file.`);
    }

    return [{ fileName, xmlText, sourceKind: "xml" as const }];
  }

  if (extension === "mp") {
    return extractCompiledManagementPack(bytes, fileName);
  }

  if (extension === "mpb" || extension === "mbp") {
    return extractManagementPackBundle(bytes, fileName);
  }

  throw new Error("Only XML, MP, and MPB files are supported.");
}
