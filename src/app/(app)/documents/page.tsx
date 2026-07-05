import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDocumentsForUser } from "@/lib/documents";
import { UploadForm } from "./components/UploadForm";
import { DocumentList } from "./components/DocumentList";

function TrustStatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "green" | "yellow" | "red";
}) {
  const toneStyle = {
    blue: {
      color: "#8abfff",
      background: "rgba(88,166,255,0.10)",
      border: "rgba(88,166,255,0.25)",
    },
    green: {
      color: "#7bed9f",
      background: "rgba(46,213,115,0.10)",
      border: "rgba(46,213,115,0.25)",
    },
    yellow: {
      color: "#ffd166",
      background: "rgba(255,193,7,0.10)",
      border: "rgba(255,193,7,0.25)",
    },
    red: {
      color: "#ff8a95",
      background: "rgba(255,71,87,0.10)",
      border: "rgba(255,71,87,0.25)",
    },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        borderRadius: 18,
        padding: 16,
        minHeight: 116,
        display: "grid",
        alignContent: "space-between",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "10px 0 6px",
          color: "var(--color-text-primary)",
          fontSize: 30,
          fontWeight: 950,
          lineHeight: 1,
        }}
      >
        {value}
      </p>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          fontWeight: 750,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function DashboardImpactPanel({
  trustedDocuments,
  needsReviewDocuments,
  rejectedDocuments,
  processedDocuments,
}: {
  trustedDocuments: number;
  needsReviewDocuments: number;
  rejectedDocuments: number;
  processedDocuments: number;
}) {
  const hasTrustedData = trustedDocuments > 0;
  const hasPendingReview = needsReviewDocuments > 0;

  return (
    <section
      className="section-card"
      style={{
        marginBottom: 24,
        display: "grid",
        gap: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
            maxWidth: 780,
          }}
        >
          <p
            className="section-title"
            style={{
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Dashboard data status
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.65,
              maxWidth: 760,
            }}
          >
            Dashboard, AI Team, and Chat update only from approved documents.
            Processed documents must be reviewed before they become trusted
            financial data.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="btn-ghost"
          style={{
            flex: "0 0 auto",
            marginTop: 2,
          }}
        >
          Open dashboard
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <TrustStatCard
          label="Trusted for dashboard"
          value={String(trustedDocuments)}
          hint={hasTrustedData ? "Dashboard can use this data" : "Approve data first"}
          tone={hasTrustedData ? "green" : "blue"}
        />

        <TrustStatCard
          label="Needs review"
          value={String(needsReviewDocuments)}
          hint={hasPendingReview ? "Review before dashboard updates" : "No pending review"}
          tone={hasPendingReview ? "yellow" : "green"}
        />

        <TrustStatCard
          label="Processed"
          value={String(processedDocuments)}
          hint="AI extraction completed"
          tone="blue"
        />

        <TrustStatCard
          label="Rejected"
          value={String(rejectedDocuments)}
          hint={rejectedDocuments > 0 ? "Excluded from dashboard" : "No rejected files"}
          tone={rejectedDocuments > 0 ? "red" : "green"}
        />
      </div>
    </section>
  );
}
export default async function DocumentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const documents = await getDocumentsForUser(session.user.id);

  const totalDocuments = documents.length;

  const processedDocuments = documents.filter(
    (doc) => doc.status === "PROCESSED",
  ).length;

  const trustedDocuments = documents.filter(
    (doc) => doc.status === "PROCESSED" && doc.reviewStatus === "APPROVED",
  ).length;

  const needsReviewDocuments = documents.filter(
    (doc) => doc.reviewStatus === "NEEDS_REVIEW",
  ).length;

  const rejectedDocuments = documents.filter(
    (doc) => doc.reviewStatus === "REJECTED",
  ).length;

  return (
    <>
      <header
        className="dashboard-header"
        style={{
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 780,
          }}
        >
          <p
            className="eyebrow"
            style={{
              margin: 0,
            }}
          >
            Document trust center
          </p>

          <h1
            style={{
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            Upload, review, and approve business data
          </h1>

          <p
            className="page-intro"
            style={{
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            Upload financial documents, let AI extract the numbers, then approve
            only trusted data before it reaches the dashboard, AI Team, and
            finance chat.
          </p>
        </div>

        <span className="badge-sample">
          {totalDocuments > 0
            ? `${totalDocuments} document${totalDocuments === 1 ? "" : "s"}`
            : "No documents yet"}
        </span>
      </header>

      <DashboardImpactPanel
        trustedDocuments={trustedDocuments}
        needsReviewDocuments={needsReviewDocuments}
        rejectedDocuments={rejectedDocuments}
        processedDocuments={processedDocuments}
      />

      <section
        className="section-card"
        style={{
          marginBottom: 24,
        }}
      >
        <div className="section-heading">
          <div>
            <p className="section-title">Trusted data workflow</p>
            <p className="section-hint">
              Dashboard, AI Team, and Chat use only approved documents. Pending
              and rejected documents stay out of trusted financial analysis.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 18,
          }}
        >
          <TrustStatCard
            label="Total documents"
            value={String(totalDocuments)}
            hint="Uploaded files"
            tone="blue"
          />

          <TrustStatCard
            label="Processed"
            value={String(processedDocuments)}
            hint="AI extraction done"
            tone="blue"
          />

          <TrustStatCard
            label="Approved"
            value={String(trustedDocuments)}
            hint="Used by dashboard"
            tone="green"
          />

          <TrustStatCard
            label="Needs review"
            value={String(needsReviewDocuments)}
            hint="Waiting for approval"
            tone={needsReviewDocuments > 0 ? "yellow" : "green"}
          />
        </div>
      </section>

      <section
        className="section-card"
        style={{
          marginBottom: 24,
        }}
      >
        <div className="section-heading">
          <div>
            <p className="section-title">Upload documents</p>
            <p className="section-hint">
              Upload bank statements, invoices, payroll, utility bills, or
              financial statements. After processing, review and approve the AI
              extraction before trusting it.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
          }}
        >
          <UploadForm />
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="section-title">Document review queue</p>
            <p className="section-hint">
              Review status controls whether each document can affect dashboard,
              agents, and chat answers.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
          }}
        >
          <DocumentList documents={documents} />
        </div>
      </section>
    </>
  );
}