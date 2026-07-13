import { createHash, timingSafeEqual } from "node:crypto";

export function secureTokenEqual(left: string, right: string) {
  if (!left || !right) return false;
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
