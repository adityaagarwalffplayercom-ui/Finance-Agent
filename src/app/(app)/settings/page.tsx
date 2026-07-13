import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWorkspaceForUser, getWorkspaceAccess, roleAtLeast } from "@/lib/workspace-context";
import { WorkspaceRole } from "@prisma/client";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";
import { getWorkspaceStorageBytes } from "@/lib/workspace-storage";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/sign-in");

  const workspace = await ensureDefaultWorkspaceForUser(session.user.id);
  const access = await getWorkspaceAccess(session.user.id, workspace.id);
  if (!access) redirect("/dashboard");

  const [members, usage, invitations, currentStorageBytes, memberships] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { name: true, email: true, emailVerified: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceUsageMonthly.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { month: "desc" },
    }),
    roleAtLeast(access.member.role, WorkspaceRole.ADMIN)
      ? prisma.workspaceInvitation.findMany({
          where: { workspaceId: workspace.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    getWorkspaceStorageBytes(workspace.id),
    prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      include: { workspace: { select: { id: true, name: true, plan: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <>
      <header className="dashboard-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Production controls</p>
          <h1 style={{ margin: "8px 0 0" }}>Workspace settings</h1>
          <p className="page-intro">Manage data consent, retention, plan usage and team permissions.</p>
        </div>
      </header>
      <WorkspaceSettingsPanel
        workspace={{
          id: workspace.id,
          name: workspace.name,
          plan: workspace.plan,
          retentionDays: workspace.retentionDays,
          aiProcessingConsentAt: workspace.aiProcessingConsentAt?.toISOString() ?? null,
          termsAcceptedAt: workspace.termsAcceptedAt?.toISOString() ?? null,
        }}
        currentRole={access.member.role}
        availableWorkspaces={memberships.map((membership) => ({
          id: membership.workspace.id,
          name: membership.workspace.name,
          plan: membership.workspace.plan,
          role: membership.role,
        }))}
        members={members.map((member) => ({ ...member, user: { ...member.user } }))}
        invitations={invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
        }))}
        usage={usage ? {
          uploads: usage.uploads,
          aiProcesses: usage.aiProcesses,
          processedPages: usage.processedPages,
          storageBytes: usage.storageBytes.toString(),
          currentStorageBytes: String(currentStorageBytes),
          estimatedCostMicros: usage.estimatedCostMicros.toString(),
        } : {
          uploads: 0,
          aiProcesses: 0,
          processedPages: 0,
          storageBytes: "0",
          currentStorageBytes: String(currentStorageBytes),
          estimatedCostMicros: "0",
        }}
      />
    </>
  );
}
