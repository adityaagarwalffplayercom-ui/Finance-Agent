import { createHash } from "node:crypto";

export type FileInspection = {
  detectedMimeType: string | null;
  sha256: string;
  isEncryptedPdf: boolean;
  zipUncompressedBytes: number | null;
  warnings: string[];
};

const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  csv: ["text/csv", "text/plain", "application/csv"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
};

function startsWith(buffer: Buffer, bytes: number[]) {
  return bytes.every((value, index) => buffer[index] === value);
}

function looksLikeCsv(buffer: Buffer) {
  const text = buffer.subarray(0, Math.min(buffer.length, 16_384)).toString("utf8");
  if (text.includes("\u0000")) return false;
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 20);
  if (lines.length < 1) return false;
  return lines.some((line) => line.includes(",") || line.includes(";") || line.includes("\t"));
}

export function detectMimeType(buffer: Buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return "application/vnd.ms-excel";
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (looksLikeCsv(buffer)) return "text/csv";
  return null;
}

function inspectZipCentralDirectory(buffer: Buffer) {
  let total = 0;
  let entries = 0;
  for (let offset = 0; offset + 46 <= buffer.length; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    total += buffer.readUInt32LE(offset + 24);
    entries += 1;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 45 + nameLength + extraLength + commentLength;
  }
  return entries > 0 ? total : null;
}

export function sanitizeFileName(value: string) {
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "");
  const base = normalized.split(/[\\/]/).at(-1) || "document";
  return base.replace(/[^a-zA-Z0-9._()\- ]+/g, "_").replace(/\s+/g, " ").slice(0, 180);
}

export function extensionOf(fileName: string) {
  const value = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  return value === fileName.toLowerCase() ? "" : value;
}

export function inspectFile(buffer: Buffer, fileName: string, declaredMimeType: string): FileInspection {
  const detectedMimeType = detectMimeType(buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const warnings: string[] = [];
  const extension = extensionOf(fileName);

  if (!detectedMimeType) throw new Error("The file signature is not a supported document format.");
  if (declaredMimeType && declaredMimeType !== "application/octet-stream") {
    const allowedDeclared = MIME_BY_EXTENSION[extension] ?? [];
    if (allowedDeclared.length > 0 && !allowedDeclared.includes(declaredMimeType)) {
      warnings.push(`Browser MIME ${declaredMimeType} does not match the file extension.`);
    }
  }
  const allowedDetected = MIME_BY_EXTENSION[extension] ?? [];
  if (extension && allowedDetected.length > 0 && !allowedDetected.includes(detectedMimeType)) {
    throw new Error(`The file extension .${extension} does not match its actual content.`);
  }

  const isEncryptedPdf =
    detectedMimeType === "application/pdf" && buffer.includes(Buffer.from("/Encrypt"));
  if (isEncryptedPdf) warnings.push("The PDF appears encrypted or password protected.");

  const zipUncompressedBytes = detectedMimeType.includes("spreadsheet")
    ? inspectZipCentralDirectory(buffer)
    : null;
  if (
    zipUncompressedBytes !== null &&
    (zipUncompressedBytes > 500 * 1024 * 1024 || zipUncompressedBytes > buffer.length * 200)
  ) {
    throw new Error("The spreadsheet expands to an unsafe size and was blocked.");
  }

  return { detectedMimeType, sha256, isEncryptedPdf, zipUncompressedBytes, warnings };
}

export function estimatePdfPageCount(buffer: Buffer) {
  if (detectMimeType(buffer) !== "application/pdf") return null;
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return matches?.length ?? null;
}
