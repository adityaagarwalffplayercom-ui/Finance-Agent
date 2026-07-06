import Link from "next/link";
import { AureliLogo } from "@/components/AureliLogo";

const UPDATED_AT = "July 2026";

export default function TermsPage() {
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
              Terms of Service
            </h1>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              These Terms explain the rules for using Aureli, an AI-powered
              finance workspace.
            </p>
          </div>

          <div className="legal-content">
            <h2>1. Use of Aureli</h2>
            <p>
              Aureli provides tools for uploading financial documents, extracting
              financial information, viewing dashboard insights, asking AI
              finance questions, and generating CFO-style reports.
            </p>

            <h2>2. No professional advice</h2>
            <p>
              Aureli is not a replacement for a certified accountant, auditor,
              tax advisor, lawyer, or financial advisor. Outputs are generated
              for informational and productivity purposes only.
            </p>

            <h2>3. User responsibility</h2>
            <p>
              Users are responsible for checking extracted data, approving only
              accurate information, and verifying all financial insights before
              making business decisions.
            </p>

            <h2>4. Uploaded documents</h2>
            <p>
              Users must only upload documents they are authorized to process.
              Users remain responsible for the content, legality, and accuracy of
              uploaded files.
            </p>

            <h2>5. Account security</h2>
            <p>
              Users are responsible for keeping login credentials secure and for
              activities that occur under their account.
            </p>

            <h2>6. AI limitations</h2>
            <p>
              AI-generated extraction, analysis, summaries, charts, alerts, and
              recommendations may contain mistakes. Users should treat outputs as
              assistance, not final professional judgment.
            </p>

            <h2>7. Acceptable use</h2>
            <p>
              Users may not misuse Aureli, attempt to break security, upload
              malicious files, violate laws, or use the service in a way that
              harms other users or the platform.
            </p>

            <h2>8. Service availability</h2>
            <p>
              Aureli may change, pause, or discontinue features. We do not
              guarantee uninterrupted or error-free operation.
            </p>

            <h2>9. Limitation of liability</h2>
            <p>
              Aureli is provided as-is. To the maximum extent permitted by law,
              we are not liable for losses caused by reliance on AI outputs,
              inaccurate data, downtime, or user decisions.
            </p>

            <h2>10. Contact</h2>
            <p>
              For questions about these Terms, contact the Aureli support team
              using the support email provided in the app or store listing.
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