import { createHmac, createHash } from "node:crypto";
import { DocumentStorageProvider } from "@prisma/client";
import { productionConfig } from "./production-config";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for S3 object storage.`);
  return value;
}

export function isS3StorageConfigured() {
  return Boolean(
    process.env.OBJECT_STORAGE_ENDPOINT &&
      process.env.OBJECT_STORAGE_BUCKET &&
      process.env.OBJECT_STORAGE_ACCESS_KEY_ID &&
      process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  );
}

export function configuredStorageProvider() {
  return isS3StorageConfigured() ? DocumentStorageProvider.S3 : DocumentStorageProvider.DATABASE;
}

function s3Config() {
  return {
    endpoint: required("OBJECT_STORAGE_ENDPOINT").replace(/\/+$/, ""),
    bucket: required("OBJECT_STORAGE_BUCKET"),
    region: process.env.OBJECT_STORAGE_REGION?.trim() || "auto",
    accessKeyId: required("OBJECT_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: required("OBJECT_STORAGE_SECRET_ACCESS_KEY"),
  };
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(key: string) {
  return key.split("/").map((part) => awsEncode(part)).join("/");
}

function objectUrl(key: string) {
  const config = s3Config();
  return new URL(`${config.endpoint}/${awsEncode(config.bucket)}/${encodePath(key)}`);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function dateParts(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export function createPresignedObjectUrl(params: {
  key: string;
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  expiresInSeconds?: number;
}) {
  const config = s3Config();
  const url = objectUrl(params.key);
  const { amzDate, dateStamp } = dateParts();
  const expires = Math.min(3600, Math.max(60, params.expiresInSeconds ?? 600));
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;

  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", String(expires));
  url.searchParams.set("X-Amz-SignedHeaders", "host");

  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
    )
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
  const canonicalRequest = [
    params.method,
    url.pathname,
    canonicalQuery,
    `host:${url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  url.searchParams.set("X-Amz-Signature", signature);
  return url.toString();
}

export function buildStorageKey(params: {
  workspaceId: string;
  userId: string;
  documentId: string;
  fileName: string;
}) {
  const extension = params.fileName.includes(".") ? `.${params.fileName.split(".").at(-1)}` : "";
  return `workspaces/${params.workspaceId}/users/${params.userId}/documents/${params.documentId}/source${extension.toLowerCase()}`;
}

export async function putObject(key: string, buffer: Buffer, mimeType: string) {
  const response = await fetch(
    createPresignedObjectUrl({ key, method: "PUT", expiresInSeconds: 900 }),
    {
      method: "PUT",
      body: new Uint8Array(buffer),
      headers: { "content-type": mimeType },
    },
  );
  if (!response.ok) throw new Error(`Object upload failed with status ${response.status}.`);
}

export async function headObject(key: string) {
  const response = await fetch(
    createPresignedObjectUrl({ key, method: "HEAD", expiresInSeconds: 300 }),
    { method: "HEAD", cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Object verification failed with status ${response.status}.`);
  const size = Number(response.headers.get("content-length"));
  return {
    size: Number.isFinite(size) ? size : null,
    mimeType: response.headers.get("content-type"),
    etag: response.headers.get("etag"),
  };
}

export async function getObjectBuffer(key: string) {
  const response = await fetch(
    createPresignedObjectUrl({ key, method: "GET", expiresInSeconds: 600 }),
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Object download failed with status ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

export async function getObjectPrefix(key: string, bytes = 16_384) {
  const response = await fetch(
    createPresignedObjectUrl({ key, method: "GET", expiresInSeconds: 300 }),
    { headers: { range: `bytes=0-${Math.max(0, bytes - 1)}` }, cache: "no-store" },
  );
  if (!response.ok && response.status !== 206) {
    throw new Error(`Object sample download failed with status ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteObject(key: string) {
  const response = await fetch(
    createPresignedObjectUrl({ key, method: "DELETE", expiresInSeconds: 300 }),
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Object deletion failed with status ${response.status}.`);
  }
}

export async function loadDocumentBuffer(document: {
  content: Uint8Array | Buffer | null;
  storageProvider: DocumentStorageProvider;
  storageKey: string | null;
}) {
  if (document.storageProvider === DocumentStorageProvider.S3) {
    if (!document.storageKey) throw new Error("Document storage key is missing.");
    return getObjectBuffer(document.storageKey);
  }
  if (!document.content) throw new Error("Document content is missing.");
  return Buffer.from(document.content);
}

export function getDocumentDownloadUrl(document: {
  storageProvider: DocumentStorageProvider;
  storageKey: string | null;
}) {
  if (document.storageProvider !== DocumentStorageProvider.S3 || !document.storageKey) return null;
  return createPresignedObjectUrl({ key: document.storageKey, method: "GET", expiresInSeconds: 120 });
}

export function canUseDirectUploads() {
  return productionConfig.directUploadsEnabled && isS3StorageConfigured();
}
