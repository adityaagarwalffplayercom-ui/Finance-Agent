import { createHash, randomBytes } from "node:crypto";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma";
import { productionConfig } from "./production-config";
import { sendTransactionalEmail } from "./email";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createWorkspaceInvitation(params: {
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "OWNER">;
  invitedById: string;
}) {
  const email = params.email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: params.workspaceId },
    select: { id: true, name: true },
  });

  await prisma.workspaceInvitation.updateMany({
    where: {
      workspaceId: params.workspaceId,
      email,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: params.workspaceId,
      email,
      role: params.role,
      tokenHash,
      invitedById: params.invitedById,
      expiresAt,
    },
  });

  const acceptUrl = new URL("/invitations/accept", productionConfig.appUrl);
  acceptUrl.searchParams.set("token", token);

  await sendTransactionalEmail({
    to: email,
    subject: `You were invited to ${workspace.name} on Actic Finance`,
    text: `Accept your Actic Finance workspace invitation: ${acceptUrl.toString()}`,
    html: `<p>You were invited to <strong>${workspace.name}</strong> on Actic Finance.</p><p><a href="${acceptUrl.toString()}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptWorkspaceInvitation(params: {
  userId: string;
  token: string;
}) {
  const tokenHash = hashToken(params.token);
  const [user, invitation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true },
    }),
    prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: { workspace: { select: { id: true, name: true } } },
    }),
  ]);

  if (!user || !invitation) throw new Error("INVITATION_NOT_FOUND");
  if (invitation.revokedAt || invitation.acceptedAt) {
    throw new Error("INVITATION_NOT_ACTIVE");
  }
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new Error("INVITATION_EXPIRED");
  }
  if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
    throw new Error("INVITATION_EMAIL_MISMATCH");
  }

  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role,
      },
      update: { role: invitation.role },
    }),
    prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { activeWorkspaceId: invitation.workspaceId },
    }),
  ]);

  return invitation.workspace;
}
