import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardRefreshButton } from "./components/DashboardRefreshButton";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

async function getDashboardDataStatus(userId: string) {
  const [approvedCount, pendingReviewCount, processingCount, failedCount] =
    await Promise.all([
      prisma.document.count({
        where: {
          userId,
          status: "PROCESSED",
          reviewStatus: "APPROVED",
        },
      }),
      prisma.document.count({
        where: {
          userId,
          status: "PROCESSED",
          reviewStatus: "NEEDS_REVIEW",
        },
      }),
      prisma.document.count({
        where: {
          userId,
          status: "PROCESSING",
        },
      }),
      prisma.document.count({
        where: {
          userId,
          status: "FAILED",
        },
      }),
    ]);

  const latestApprovedDocument = await prisma.document.findFirst({
    where: {
      userId,
      status: "PROCESSED",
      reviewStatus: "APPROVED",
    },
    orderBy: [
      {
        reviewedAt: "desc",
      },
      {
        extractedAt: "desc",
      },
      {
        uploadedAt: "desc",
      },
    ],
    select: {
      reviewedAt: true,
      extractedAt: true,
      uploadedAt: true,
    },
  });

  const lastTrustedUpdate =
    latestApprovedDocument?.reviewedAt ??
    latestApprovedDocument?.extractedAt ??
    latestApprovedDocument?.uploadedAt ??
    null;

  return {
    approvedCount,
    pendingReviewCount,
    processingCount,
    failedCount,
    lastTrustedUpdate,
  };
}

function formatDateTime(date: Date | null) {
  if (!date) return "No trusted update yet";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warning" | "danger" | "neutral";
}) {
  const toneStyle =
    tone === "good"
      ? {
          border: "1px solid rgba(46,213,115,0.22)",
          background: "rgba(46,213,115,0.08)",
          color: "#7bed9f",
        }
      : tone === "warning"
        ? {
            border: "1px solid rgba(255,193,7,0.22)",
            background: "rgba(255,193,7,0.08)",
            color: "#ffd166",
          }
        : tone === "danger"
          ? {
              border: "1px solid rgba(255,71,87,0.22)",
              background: "rgba(255,71,87,0.08)",
              color: "#ff8a95",
            }
          : {
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-secondary)",
            };

  return (
    <span
      style={{
        ...toneStyle,
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 850,
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {label}:{" "}
      <strong
        style={{
          color: "inherit",
        }}
      >
        {value}
      </strong>
    </span>
  );
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const status = session?.user?.id
    ? await getDashboardDataStatus(session.user.id)
    : {
        approvedCount: 0,
        pendingReviewCount: 0,
        processingCount: 0,
        failedCount: 0,
        lastTrustedUpdate: null,
      };

  return (
    <>
      <section
        className="alerts-card"
        style={{
          marginBottom: 22,
          display: "grid",
          gap: 14,
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 6,
              maxWidth: 760,
            }}
          >
            <p
              className="section-title"
              style={{
                margin: 0,
              }}
            >
              Dashboard data status
            </p>

            <p
              className="section-hint"
              style={{
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              Dashboard updates only from approved financial documents. After
              approving a document, refresh the dashboard to reload trusted
              numbers.
            </p>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted)",
                fontSize: 12,
              }}
            >
              Last trusted update: {formatDateTime(status.lastTrustedUpdate)}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <DashboardRefreshButton />

            {status.pendingReviewCount > 0 && (
              <Link href="/documents" className="btn-ghost">
                Review pending
              </Link>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <StatusPill
            label="Approved"
            value={status.approvedCount}
            tone={status.approvedCount > 0 ? "good" : "neutral"}
          />

          <StatusPill
            label="Needs review"
            value={status.pendingReviewCount}
            tone={status.pendingReviewCount > 0 ? "warning" : "neutral"}
          />

          <StatusPill
            label="Processing"
            value={status.processingCount}
            tone={status.processingCount > 0 ? "warning" : "neutral"}
          />

          <StatusPill
            label="Failed"
            value={status.failedCount}
            tone={status.failedCount > 0 ? "danger" : "neutral"}
          />
        </div>
      </section>

      {children}
    </>
  );
}