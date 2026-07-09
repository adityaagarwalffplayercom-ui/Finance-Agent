import { NextResponse } from "next/server";
import {
  adminForbiddenResponse,
  isAuthorizedByAdminSecret,
} from "@/lib/admin-auth";
import {
  adminPrisma,
  assertGlobalAdminResource,
  getPrivacyFirewallPolicy,
  isAdminPrivacyError,
} from "@/lib/privacy-firewall";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedByAdminSecret(request)) {
    return adminForbiddenResponse(request);
  }

  assertGlobalAdminResource("privacy_check");

  let privateUserDataAccessBlocked = false;
  let privateUserDataTestMessage = "";

  try {
    await adminPrisma.user.count();

    privateUserDataAccessBlocked = false;
    privateUserDataTestMessage =
      "FAILED: adminPrisma was able to access User model.";
  } catch (error) {
    if (isAdminPrivacyError(error)) {
      privateUserDataAccessBlocked = true;
      privateUserDataTestMessage =
        "PASSED: adminPrisma blocked User model access.";
    } else {
      throw error;
    }
  }

  const [taxRulesCount, taxKnowledgeDocumentsCount, taxKnowledgeChunksCount] =
    await Promise.all([
      adminPrisma.taxRule.count(),
      adminPrisma.taxSourceDocument.count(),
      adminPrisma.taxKnowledgeChunk.count(),
    ]);

  return NextResponse.json({
    message: "Admin Privacy Firewall is active.",
    privateUserDataAccessBlocked,
    privateUserDataTestMessage,
    globalAdminAccessStillAllowed: {
      taxRulesCount,
      taxKnowledgeDocumentsCount,
      taxKnowledgeChunksCount,
    },
    policy: getPrivacyFirewallPolicy(),
  });
}