import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceRole } from "@/lib/workspace-context";
import { limitsForPlan } from "@/lib/plan-limits";
import { createAuditEvent } from "@/lib/audit-log";
import { createWorkspaceInvitation } from "@/lib/workspace-invitations";
import { roleAtLeast } from "@/lib/workspace-context";

type Context = { params: Promise<{ id: string }> };
const ASSIGNABLE_ROLES: WorkspaceRole[] = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.ACCOUNTANT,
  WorkspaceRole.ANALYST,
  WorkspaceRole.VIEWER,
  WorkspaceRole.AUDITOR,
];

export async function GET(request: Request, context: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const access = await requireWorkspaceRole(session.user.id, id, WorkspaceRole.VIEWER);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: id },
    include: { user: { select: { id: true, name: true, email: true, emailVerified: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });
  const invitations = roleAtLeast(access.member.role, WorkspaceRole.ADMIN)
    ? await prisma.workspaceInvitation.findMany({
        where: {
          workspaceId: id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  return NextResponse.json({ members, invitations });
}

export async function POST(request: Request, context: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const access = await requireWorkspaceRole(session.user.id, id, WorkspaceRole.ADMIN);
  const body = await request.json().catch(() => null) as { email?: string; role?: WorkspaceRole } | null;
  const email = body?.email?.trim().toLowerCase();
  const role = body?.role;
  if (!email || !role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Valid member email and role required." }, { status: 400 });
  }
  const [memberCount, invitationCount] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: id } }),
    prisma.workspaceInvitation.count({
      where: { workspaceId: id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  if (memberCount + invitationCount >= limitsForPlan(access.workspace.plan).members) {
    return NextResponse.json({ error: "Workspace member limit reached for this plan." }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const invitation = await createWorkspaceInvitation({
      workspaceId: id,
      email,
      role: role as Exclude<WorkspaceRole, "OWNER">,
      invitedById: session.user.id,
    });
    await createAuditEvent({
      userId: session.user.id,
      workspaceId: id,
      eventType: "WORKSPACE_MEMBER_INVITED",
      title: "Workspace invitation sent",
      description: `${email} was invited as ${role.toLowerCase()}.`,
      metadata: { invitationId: invitation.id, role },
    });
    return NextResponse.json({ invitation }, { status: 202 });
  }
  const member = await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: id, userId: user.id } },
    create: { workspaceId: id, userId: user.id, role },
    update: { role },
  });
  await createAuditEvent({
    userId: session.user.id,
    workspaceId: id,
    eventType: "WORKSPACE_MEMBER_ADDED",
    title: "Workspace member added",
    description: `${user.email} was added as ${role.toLowerCase()}.`,
    metadata: { memberUserId: user.id, role },
  });
  return NextResponse.json({ member });
}

export async function DELETE(request: Request, context: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  await requireWorkspaceRole(session.user.id, id, WorkspaceRole.ADMIN);
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required." }, { status: 400 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (member.role === WorkspaceRole.OWNER) {
    return NextResponse.json({ error: "Workspace owner cannot be removed." }, { status: 400 });
  }
  await prisma.workspaceMember.delete({ where: { id: member.id } });
  await createAuditEvent({
    userId: session.user.id,
    workspaceId: id,
    eventType: "WORKSPACE_MEMBER_REMOVED",
    title: "Workspace member removed",
    description: "A workspace member was removed.",
    metadata: { memberUserId: userId, previousRole: member.role },
  });
  return NextResponse.json({ success: true });
}
