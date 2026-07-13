import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setActiveWorkspace } from "@/lib/workspace-context";
import { createAuditEvent } from "@/lib/audit-log";

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { workspaceId?: string } | null;
  if (!body?.workspaceId) return NextResponse.json({ error: "Workspace ID required." }, { status: 400 });

  try {
    const workspace = await setActiveWorkspace(session.user.id, body.workspaceId);
    await createAuditEvent({
      userId: session.user.id,
      workspaceId: workspace.id,
      eventType: "ACTIVE_WORKSPACE_CHANGED",
      title: "Active workspace changed",
      description: `${workspace.name} is now the active workspace.`,
    });
    return NextResponse.json({ workspace });
  } catch {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }
}
