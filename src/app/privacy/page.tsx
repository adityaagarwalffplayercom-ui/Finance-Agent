import Link from "next/link";
import { AureliLogo } from "@/components/AureliLogo";

const UPDATED_AT = "July 2026";

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), linear-gradient(180deg, #090d14 0%, #0b111b 100%)",
        color: "var(--color-text-primary)",
        padding: "28px 18px 70px",
      }}
    >
      <section
        style={{
          width: "min(920px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: 22,
        }}
      >
        <nav
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            <AureliLogo size={38} showWordmark tagline="AI finance workspace" />
          </Link>

          <Link href="/" className="btn-ghost">
            Back home
          </Link>
        </nav>

        <article
          style={{
            border: "1px solid rgba(255,209,102,0.18)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.070), rgba(255,255,255,0.026))",
            borderRadius: 30,
            padding: 28,
            display: "grid",
            gap: 18,
            boxShadow: "0 28px 100px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              Updated {UPDATED_AT}
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(38px, 8vw, 70px)",
                lineHeight: 0.95,
                letterSpacing: "-0.08em",
                fontWeight: 950,
              }}
            >
              Privacy Policy
            </h1>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              This Privacy Policy explains how Aureli collects, uses, and
              protects information when users access the Aureli finance
              workspace.
            </p>
          </div>

          <div className="legal-content">
            <h2>1. Information we collect</h2>
            <p>
              Aureli may collect account information such as name, email address,
              login details, business profile details, uploaded financial
              documents, extracted financial data, AI chat inputs, and usage
              activity inside the application.
            </p>

            <h2>2. How we use information</h2>
            <p>
              We use information to provide authentication, business profile
              setup, document upload and extraction, dashboard analytics,
              CFO-style reports, AI finance chat, product improvement, and
              security monitoring.
            </p>

            <h2>3. Financial documents</h2>
            <p>
              Uploaded financial documents are processed to extract business
              financial data such as revenue, expenses, profit, cash flow,
              dates, summaries, and related document information. Dashboard and
              AI insights are generated only from data available inside the
              user&apos;s workspace.
            </p>

            <h2>4. AI processing</h2>
            <p>
              Aureli may use third-party AI services to process uploaded
              documents and generate finance insights. Users should review
              extracted information before relying on it for business decisions.
            </p>

            <h2>5. Data sharing</h2>
            <p>
              We do not sell user data. Data may be shared with service providers
              needed to operate the application, such as hosting, database,
              authentication, analytics, and AI processing providers.
            </p>

            <h2>6. Data security</h2>
            <p>
              We use reasonable technical and organizational measures to protect
              user data. However, no online service can guarantee complete
              security.
            </p>

            <h2>7. User responsibility</h2>
            <p>
              Users are responsible for uploading documents they are authorized
              to use and for verifying financial outputs before making business,
              tax, accounting, legal, or investment decisions.
            </p>

            <h2>8. Data retention</h2>
            <p>
              Data may be retained while an account is active or as needed to
              provide the service, comply with obligations, resolve disputes, and
              improve the application.
            </p>

            <h2>9. Contact</h2>
            <p>
              For privacy-related requests, contact the Aureli support team using
              the support email provided in the app or store listing.
            </p>
          </div>
        </article>
      </section>

      <style>
        {`
          .legal-content {
            display: grid;
            gap: 14px;
          }

          .legal-content h2 {
            margin: 12px 0 0;
            color: var(--color-text-primary);
            font-size: 20px;
            line-height: 1.2;
            letter-spacing: -0.04em;
          }

          .legal-content p {
            margin: 0;
            color: var(--color-text-secondary);
            font-size: 14px;
            line-height: 1.75;
          }

          @media (max-width: 640px) {
            article {
              padding: 20px !important;
              border-radius: 24px !important;
            }
          }
        `}
      </style>
    </main>
  );
}