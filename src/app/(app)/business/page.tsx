import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessProfileForm } from "./BusinessProfileForm";

function InfoCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "green" | "yellow" | "blue";
}) {
  const toneStyle = {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.26)",
      background: "rgba(46,213,115,0.08)",
    },
    yellow: {
      color: "#ffd166",
      border: "rgba(255,193,7,0.28)",
      background: "rgba(255,193,7,0.08)",
    },
    blue: {
      color: "#8abfff",
      border: "rgba(88,166,255,0.28)",
      background: "rgba(88,166,255,0.08)",
    },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        borderRadius: 18,
        padding: 16,
        minHeight: 122,
        display: "grid",
        alignContent: "space-between",
        gap: 8,
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

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 22,
          lineHeight: 1.15,
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.4,
          fontWeight: 750,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

export default async function BusinessProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      name: true,
      industry: true,
      businessType: true,
      financialYear: true,
      currency: true,
      country: true,
      updatedAt: true,
    },
  });

  const initialValues = {
    name: business?.name ?? "",
    industry: business?.industry ?? "",
    businessType: business?.businessType ?? "",
    financialYear: business?.financialYear ?? "",
    currency: business?.currency ?? "INR",
    country: business?.country ?? "India",
  };

  const completionItems = [
    Boolean(initialValues.name),
    Boolean(initialValues.industry),
    Boolean(initialValues.businessType),
    Boolean(initialValues.financialYear),
    Boolean(initialValues.currency),
    Boolean(initialValues.country),
  ];

  const completedCount = completionItems.filter(Boolean).length;
  const completionPercent = Math.round(
    (completedCount / completionItems.length) * 100,
  );

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
            maxWidth: 820,
          }}
        >
          <p
            className="eyebrow"
            style={{
              margin: 0,
            }}
          >
            Business profile
          </p>

          <h1
            style={{
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            Set up your company context
          </h1>

          <p
            className="page-intro"
            style={{
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 760,
            }}
          >
            Tell Actic Finance what kind of business this is. Your AI finance team can
            use this context for better dashboard interpretation, CFO reports,
            and chat answers.
          </p>
        </div>

        <span className="badge-sample">
          {business ? `${completionPercent}% complete` : "Not set up"}
        </span>
      </header>

      <section
        className="section-card"
        style={{
          marginBottom: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          <InfoCard
            label="Profile status"
            value={business ? "Created" : "Missing"}
            hint={
              business
                ? "Business context is available"
                : "Create profile to improve AI"
            }
            tone={business ? "green" : "yellow"}
          />

          <InfoCard
            label="Currency"
            value={initialValues.currency}
            hint="Used as default financial currency"
            tone="blue"
          />

          <InfoCard
            label="Country"
            value={initialValues.country || "Not selected"}
            hint="Useful for tax and compliance context"
            tone={initialValues.country ? "green" : "yellow"}
          />

          <InfoCard
            label="Financial year"
            value={initialValues.financialYear || "Not set"}
            hint="Helps period-based analysis"
            tone={initialValues.financialYear ? "green" : "yellow"}
          />
        </div>
      </section>

      <section
        className="section-card"
        style={{
          marginBottom: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 6,
          }}
        >
          <p
            className="section-title"
            style={{
              margin: 0,
            }}
          >
            Company details
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            This does not change uploaded documents. It gives the finance AI
            better business context.
          </p>
        </div>

        <BusinessProfileForm
          initialValues={initialValues}
          hasBusinessProfile={Boolean(business)}
        />
      </section>

      <section
        className="section-card"
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 6,
          }}
        >
          <p
            className="section-title"
            style={{
              margin: 0,
            }}
          >
            Where this profile is used
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            Business context improves every downstream finance workflow.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link href="/dashboard" className="btn-ghost">
            Dashboard
          </Link>

          <Link href="/chat" className="btn-ghost">
            AI Business Chat
          </Link>

          <Link href="/reports/cfo" className="btn-ghost">
            CFO Report
          </Link>

          <Link href="/documents" className="btn-ghost">
            Documents
          </Link>
        </div>
      </section>
    </>
  );
}