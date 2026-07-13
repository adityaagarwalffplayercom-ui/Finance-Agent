import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectUploadedFile } from "../src/lib/file-security.ts";

test("accepts a real PDF signature", () => {
  const result = inspectUploadedFile(Buffer.from("%PDF-1.7\nexample"), "application/pdf", "statement.pdf");
  assert.equal(result.safe, true);
  assert.equal(result.detectedMimeType, "application/pdf");
  assert.equal(result.sha256.length, 64);
});

test("rejects an executable disguised as PDF", () => {
  const result = inspectUploadedFile(Buffer.from("MZfake-executable"), "application/pdf", "statement.pdf");
  assert.equal(result.safe, false);
});

test("accepts XLSX ZIP containers", () => {
  const result = inspectUploadedFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "book.xlsx");
  assert.equal(result.safe, true);
});
