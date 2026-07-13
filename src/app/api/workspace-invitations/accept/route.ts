import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { acceptWorkspaceInvitation } from "@/lib/workspace-invitations";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in before accepting this invitation." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: "Invalid invitation token." }, { status: 400 });
  }

  try {
    const workspace = await acceptWorkspaceInvitation({
      userId: session.user.id,
      token,
    });
    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVITATION_FAILED";
    const messages: Record<string, string> = {
      INVITATION_NOT_FOUND: "This invitation does not exist.",
      INVITATION_NOT_ACTIVE: "This invitation was already used or revoked.",
      INVITATION_EXPIRED: "This invitation has expired.",
      INVITATION_EMAIL_MISMATCH: "Sign in with the email address that received the invitation.",
    };
    return NextResponse.json(
      { error: messages[code] ?? "Invitation could not be accepted." },
      { status: code === "INVITATION_EMAIL_MISMATCH" ? 403 : 400 },
    );
  }
}
