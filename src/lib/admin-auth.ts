import { NextResponse } from "next/server";

export function getExpectedAdminSecret() {
  return process.env.ADMIN_API_SECRET?.trim() ?? "";
}

export function getReceivedAdminSecret(request: Request) {
  return request.headers.get("x-admin-api-secret")?.trim() ?? "";
}

export function isAuthorizedByAdminSecret(request: Request) {
  const expectedSecret = getExpectedAdminSecret();

  if (!expectedSecret) {
    return false;
  }

  return getReceivedAdminSecret(request) === expectedSecret;
}

export function adminForbiddenResponse(request: Request) {
  const receivedSecret = getReceivedAdminSecret(request);
  const expectedSecret = getExpectedAdminSecret();

  return NextResponse.json(
    {
      error: "Admin API secret required.",
      debug: {
        adminSecretConfigured: Boolean(expectedSecret),
        receivedXAdminSecretHeader: Boolean(receivedSecret),
        receivedSecretLength: receivedSecret.length,
        expectedSecretLength: expectedSecret.length,
        secretMatched: receivedSecret === expectedSecret,
      },
    },
    {
      status: 403,
    },
  );
}