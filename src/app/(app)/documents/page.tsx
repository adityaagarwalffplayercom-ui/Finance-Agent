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
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          color: "var(--color-text-secondary)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 850,
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "0 0 6px",
          color: toneStyle.color,
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 950,
        }}
      >
        {value}
      </p>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {hint}
      </p>
    </div>
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
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Document trust center</p>
          <h1>Upload, review, and approve business data</h1>
        </div>
      </header>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <div>
          <p className="section-title">Trusted data workflow</p>
          <p className="section-hint">
            Dashboard, AI Team, and chat use only approved documents. Pending
            and rejected documents stay out of trusted financial analysis.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
            gap: 14,
          }}
        >
          <TrustStatCard
            label="Trusted"
            value={String(trustedDocuments)}
            hint="Approved documents used by dashboard and AI."
            tone="green"
          />

          <TrustStatCard
            label="Needs review"
            value={String(needsReviewDocuments)}
            hint="Documents waiting for human verification."
            tone="yellow"
          />

          <TrustStatCard
            label="Rejected"
            value={String(rejectedDocuments)}
            hint="Excluded from trusted analysis."
            tone="red"
          />

          <TrustStatCard
            label="Processed"
            value={`${processedDocuments}/${totalDocuments}`}
            hint="AI-processed documents out of total uploads."
            tone="blue"
          />
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <div>
          <p className="section-title">Upload documents</p>
          <p className="section-hint">
            Upload bank statements, invoices, payroll, utility bills, or
            financial statements. After processing, review and approve the AI
            extraction before trusting it.
          </p>
        </div>

        <UploadForm />
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <div>
          <p className="section-title">Document review queue</p>
          <p className="section-hint">
            Review status controls whether each document can affect dashboard,
            agents, and chat answers.
          </p>
        </div>

        <DocumentList documents={documents} />
      </section>
    </>
  );
}