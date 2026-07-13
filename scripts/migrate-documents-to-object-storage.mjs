import { createHash, createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const LIMIT = Math.max(1, Math.min(500, Number(process.env.STORAGE_MIGRATION_BATCH_SIZE ?? 25)));

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function config() {
  return {
    endpoint: required("OBJECT_STORAGE_ENDPOINT").replace(/\/+$/, ""),
    bucket: required("OBJECT_STORAGE_BUCKET"),
    region: process.env.OBJECT_STORAGE_REGION?.trim() || "auto",
    accessKeyId: required("OBJECT_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: required("OBJECT_STORAGE_SECRET_ACCESS_KEY"),
  };
}

function encodePath(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function presignedPutUrl(key, expires = 900) {
  const cfg = config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const url = new URL(`${cfg.endpoint}/${encodeURIComponent(cfg.bucket)}/${encodePath(key)}`);
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${cfg.accessKeyId}/${scope}`);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", String(expires));
  url.searchParams.set("X-Amz-SignedHeaders", "host");
  const query = [...url.searchParams.entries()]
    .sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const canonical = ["PUT", url.pathname, query, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const dateKey = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, cfg.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  url.searchParams.set("X-Amz-Signature", createHmac("sha256", signingKey).update(stringToSign).digest("hex"));
  return url.toString();
}

function safeExtension(name) {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  return match?.[0] ?? "";
}

async function migrateDocument(document) {
  if (!document.content) return { id: document.id, status: "skipped", reason: "no database bytes" };
  const buffer = Buffer.from(document.content);
  const hash = createHash("sha256").update(buffer).digest("hex");
  const key = `workspaces/${document.workspaceId}/users/${document.userId}/documents/${document.id}/source${safeExtension(document.fileName)}`;

  if (!APPLY) {
    return { id: document.id, status: "dry-run", key, bytes: buffer.length, sha256: hash };
  }

  const response = await fetch(presignedPutUrl(key), {
    method: "PUT",
    headers: { "content-type": document.detectedMimeType ?? document.mimeType },
    body: new Uint8Array(buffer),
  });
  if (!response.ok) throw new Error(`Upload failed for ${document.id}: HTTP ${response.status}`);

  await prisma.document.update({
    where: { id: document.id },
    data: {
      storageProvider: "S3",
      storageKey: key,
      content: null,
      sha256: document.sha256 ?? hash,
    },
  });
  return { id: document.id, status: "migrated", key, bytes: buffer.length };
}

try {
  console.log(APPLY ? "APPLY MODE: database bytes will be moved to object storage." : "DRY RUN: pass --apply to migrate.");
  let migrated = 0;
  while (true) {
    const documents = await prisma.document.findMany({
      where: { storageProvider: "DATABASE", content: { not: null }, workspaceId: { not: null } },
      orderBy: { uploadedAt: "asc" },
      take: LIMIT,
      select: {
        id: true,
        userId: true,
        workspaceId: true,
        fileName: true,
        mimeType: true,
        detectedMimeType: true,
        sha256: true,
        content: true,
      },
    });
    if (documents.length === 0) break;
    for (const document of documents) {
      const result = await migrateDocument(document);
      console.log(JSON.stringify(result));
      if (result.status === "migrated") migrated += 1;
    }
    if (!APPLY) break;
  }
  console.log(`Completed. Migrated documents: ${migrated}.`);
} finally {
  await prisma.$disconnect();
}
