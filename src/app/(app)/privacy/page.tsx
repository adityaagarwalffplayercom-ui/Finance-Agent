"use client";

import { useState } from "react";
import Link from "next/link";

const exportItems = [
  "Account profile",
  "Business profile",
  "Uploaded document metadata",
  "Extracted document data preview",
  "AI finance chat history",
  "Usage and audit events",
];

const privacyPrinciples = [
  "Export and delete actions use your logged-in session only.",
  "The browser cannot pass another userId.",
  "Admin tax tools are separate from user business data.",
  "Global tax knowledge is not included in user export/delete.",
  "Delete actions require exact confirmation text.",
  "PDF export is made for human review.",
];

export default function PrivacyPage() {
  const [businessDeleteConfirmation, setBusinessDeleteConfirmation] =
    useState("");
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] =
    useState("");
  const [isDeletingBusinessData, setIsDeletingBusinessData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "warning">(
    "warning",
  );

  function showMessage(text: string, type: "success" | "warning" = "warning") {
    setMessage(text);
    setMessageType(type);
  }

  async function deleteBusinessData() {
    setMessage("");

    if (businessDeleteConfirmation !== "DELETE_MY_BUSINESS_DATA") {
      showMessage("Type DELETE_MY_BUSINESS_DATA exactly before deleting.");
      return;
    }

    const confirmed = window.confirm(
      "This will delete your business profile, documents, extracted data, chats, usage events, and audit events. Your login account will remain. Continue?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingBusinessData(true);

    try {
      const response = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "business_data",
          confirmation: "DELETE_MY_BUSINESS_DATA",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.error || "Could not delete business data.");
        return;
      }

      showMessage("Business data deleted successfully.", "success");
      setBusinessDeleteConfirmation("");
    } catch {
      showMessage("Something went wrong while deleting business data.");
    } finally {
      setIsDeletingBusinessData(false);
    }
  }

  async function deleteAccount() {
    setMessage("");

    if (accountDeleteConfirmation !== "DELETE_MY_ACCOUNT") {
      showMessage("Type DELETE_MY_ACCOUNT exactly before deleting account.");
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete your Actic Finance account and user-owned data. This action cannot be undone. Continue?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "account",
          confirmation: "DELETE_MY_ACCOUNT",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.error || "Could not delete account.");
        return;
      }

      showMessage("Account deleted successfully.", "success");
      setAccountDeleteConfirmation("");
    } catch {
      showMessage("Something went wrong while deleting account.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <main>
      <style jsx>{`
        .privacy-page {
          display: grid;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }

        .privacy-hero {
          overflow: hidden;
        }

        .privacy-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: start;
        }

        .privacy-copy {
          min-width: 0;
          max-width: 860px;
        }

        .privacy-eyebrow {
          display: block;
          margin: 0 0 14px;
          font-size: 12px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(245, 158, 11, 0.92);
        }

        .privacy-title {
          display: block;
          margin: 0;
          max-width: 820px;
          font-size: clamp(36px, 5.8vw, 72px) !important;
          line-height: 1.08 !important;
          letter-spacing: -0.045em;
          color: rgb(255, 255, 255);
          overflow-wrap: anywhere;
        }

        .privacy-description {
          display: block;
          margin: 18px 0 0 !important;
          max-width: 760px;
          color: rgba(226, 232, 240, 0.74);
          font-size: 15px !important;
          line-height: 1.75 !important;
        }

        .privacy-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
          padding-top: 32px;
        }

        .privacy-primary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border-radius: 999px;
          padding: 12px 18px;
          border: 1px solid rgba(245, 158, 11, 0.42);
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.96),
            rgba(251, 191, 36, 0.9)
          );
          color: rgb(24, 24, 27);
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(245, 158, 11, 0.18);
          white-space: nowrap;
        }

        .privacy-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .privacy-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .privacy-mini-card,
        .privacy-delete-card {
          min-width: 0;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(
              circle at top left,
              rgba(245, 158, 11, 0.14),
              transparent 36%
            ),
            rgba(255, 255, 255, 0.045);
          padding: 18px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
        }

        .privacy-delete-card-red {
          border-color: rgba(248, 113, 113, 0.16);
          background:
            radial-gradient(
              circle at top left,
              rgba(248, 113, 113, 0.13),
              transparent 38%
            ),
            rgba(255, 255, 255, 0.045);
        }

        .privacy-mini-icon {
          display: flex;
          width: 42px;
          height: 42px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.18);
          font-size: 20px;
        }

        .privacy-mini-title,
        .privacy-card-title {
          margin: 14px 0 0;
          font-size: 18px;
          line-height: 1.25 !important;
          font-weight: 900;
          color: rgb(255, 255, 255);
        }

        .privacy-card-title {
          margin-top: 0;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .privacy-mini-text,
        .privacy-card-text {
          margin: 8px 0 0;
          color: rgba(226, 232, 240, 0.72);
          font-size: 13px;
          line-height: 1.65 !important;
        }

        .privacy-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .privacy-list-item {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.18);
          padding: 12px 13px;
          color: rgba(226, 232, 240, 0.8);
          font-size: 13px;
          line-height: 1.5 !important;
        }

        .privacy-list-item span {
          color: rgba(52, 211, 153, 0.96);
          font-weight: 900;
          margin-right: 8px;
        }

        .privacy-alert {
          border-radius: 24px;
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.6 !important;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.1);
          color: rgba(254, 243, 199, 0.95);
        }

        .privacy-alert-success {
          border-color: rgba(52, 211, 153, 0.25);
          background: rgba(52, 211, 153, 0.1);
          color: rgba(209, 250, 229, 0.95);
        }

        .privacy-code {
          display: block;
          margin-top: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.24);
          padding: 12px 13px;
          color: rgba(253, 230, 138, 0.95);
          font-size: 12px;
          font-weight: 800;
          overflow-x: auto;
        }

        .privacy-input {
          margin-top: 14px;
          width: 100%;
          min-height: 44px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.22);
          padding: 12px 14px;
          color: white;
          outline: none;
          font-size: 13px;
        }

        .privacy-input::placeholder {
          color: rgba(148, 163, 184, 0.75);
        }

        .privacy-delete-button {
          margin-top: 14px;
          display: inline-flex;
          width: 100%;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(245, 158, 11, 0.36);
          background: rgba(245, 158, 11, 0.14);
          color: rgba(254, 243, 199, 0.96);
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .privacy-delete-button-red {
          border-color: rgba(248, 113, 113, 0.32);
          background: rgba(248, 113, 113, 0.14);
          color: rgba(254, 226, 226, 0.96);
        }

        .privacy-delete-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .privacy-note {
          margin: 0;
          color: rgba(148, 163, 184, 0.9);
          font-size: 12px;
          line-height: 1.7 !important;
        }

        @media (max-width: 980px) {
          .privacy-hero-grid,
          .privacy-grid-3,
          .privacy-grid-2,
          .privacy-list {
            grid-template-columns: 1fr;
          }

          .privacy-actions {
            justify-content: flex-start;
            padding-top: 0;
          }

          .privacy-primary-action,
          .privacy-actions .btn-ghost {
            width: 100%;
          }

          .privacy-title {
            font-size: clamp(34px, 11vw, 54px) !important;
            line-height: 1.1 !important;
            letter-spacing: -0.04em;
          }

          .privacy-description {
            font-size: 14px !important;
            line-height: 1.7 !important;
          }
        }

        @media (max-width: 560px) {
          .privacy-title {
            font-size: clamp(32px, 10vw, 44px) !important;
            line-height: 1.12 !important;
            letter-spacing: -0.035em;
          }

          .privacy-description {
            margin-top: 14px !important;
            font-size: 13px !important;
          }
        }
      `}</style>

      <div className="privacy-page">
        <section className="section-card privacy-hero">
          <div className="privacy-hero-grid">
            <div className="privacy-copy">
              <p className="privacy-eyebrow">Privacy Center</p>

              <h1 className="privacy-title">Export and control your data.</h1>

              <p className="privacy-description">
                Download your Actic Finance user-owned data as a PDF, review what is
                included, and delete business data when needed. Every action is
                scoped to your logged-in session.
              </p>
            </div>

            <div className="privacy-actions">
              <a href="/api/privacy/export" className="privacy-primary-action">
                Export PDF
              </a>

              <a
                href="/api/privacy/export?format=json"
                className="btn-ghost"
                target="_blank"
                rel="noreferrer"
              >
                Export JSON
              </a>
            </div>
          </div>
        </section>

        {message ? (
          <div
            className={`privacy-alert ${
              messageType === "success" ? "privacy-alert-success" : ""
            }`}
          >
            {message}
          </div>
        ) : null}

        <section className="privacy-grid-3">
          <article className="privacy-mini-card">
            <div className="privacy-mini-icon">📤</div>
            <h2 className="privacy-mini-title">PDF export</h2>
            <p className="privacy-mini-text">
              Generate a clean user data PDF from your account, business,
              documents, extracted data previews, chats, and audit events.
            </p>
          </article>

          <article className="privacy-mini-card">
            <div className="privacy-mini-icon">🧱</div>
            <h2 className="privacy-mini-title">Privacy firewall</h2>
            <p className="privacy-mini-text">
              User data stays separated from global tax rules and source
              knowledge.
            </p>
          </article>

          <article className="privacy-mini-card">
            <div className="privacy-mini-icon">✅</div>
            <h2 className="privacy-mini-title">User scoped</h2>
            <p className="privacy-mini-text">
              Export and delete APIs never accept arbitrary user IDs from the
              browser.
            </p>
          </article>
        </section>

        <section className="section-card">
          <div className="privacy-hero-grid">
            <div className="privacy-copy">
              <p className="privacy-eyebrow">Included in export</p>
              <h2 className="privacy-card-title">What your PDF contains</h2>
              <p className="section-hint">
                The PDF is designed for human review. JSON export is also
                available for machine-readable backup.
              </p>
            </div>

            <div className="privacy-actions">
              <Link href="/documents" className="btn-ghost">
                Review documents
              </Link>
            </div>
          </div>

          <div className="privacy-list">
            {exportItems.map((item) => (
              <div key={item} className="privacy-list-item">
                <span>✓</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div>
            <p className="privacy-eyebrow">Protection model</p>
            <h2 className="privacy-card-title">How Actic Finance protects user data</h2>
            <p className="section-hint">
              These are application-level privacy controls for the logged-in
              workspace.
            </p>
          </div>

          <div className="privacy-list">
            {privacyPrinciples.map((principle) => (
              <div key={principle} className="privacy-list-item">
                <span>✓</span>
                {principle}
              </div>
            ))}
          </div>
        </section>

        <section className="privacy-grid-2">
          <article className="privacy-delete-card">
            <p className="privacy-eyebrow">Business data delete</p>
            <h2 className="privacy-card-title">Delete business data</h2>
            <p className="privacy-card-text">
              Deletes business profile, documents, extracted data, chats, usage
              events, and audit events. Login account remains active.
            </p>

            <code className="privacy-code">DELETE_MY_BUSINESS_DATA</code>

            <input
              value={businessDeleteConfirmation}
              onChange={(event) =>
                setBusinessDeleteConfirmation(event.target.value)
              }
              placeholder="Type confirmation here"
              className="privacy-input"
            />

            <button
              type="button"
              onClick={deleteBusinessData}
              disabled={isDeletingBusinessData}
              className="privacy-delete-button"
            >
              {isDeletingBusinessData ? "Deleting..." : "Delete business data"}
            </button>
          </article>

          <article className="privacy-delete-card privacy-delete-card-red">
            <p className="privacy-eyebrow">Permanent delete</p>
            <h2 className="privacy-card-title">Delete account</h2>
            <p className="privacy-card-text">
              Permanently deletes your Actic Finance account and user-owned data. This
              action cannot be undone.
            </p>

            <code className="privacy-code">DELETE_MY_ACCOUNT</code>

            <input
              value={accountDeleteConfirmation}
              onChange={(event) =>
                setAccountDeleteConfirmation(event.target.value)
              }
              placeholder="Type confirmation here"
              className="privacy-input"
            />

            <button
              type="button"
              onClick={deleteAccount}
              disabled={isDeletingAccount}
              className="privacy-delete-button privacy-delete-button-red"
            >
              {isDeletingAccount ? "Deleting..." : "Delete account"}
            </button>
          </article>
        </section>

        <section className="section-card">
          <p className="privacy-note">
            Security note: Direct access to Neon database credentials, Vercel
            environment variables, or production infrastructure can still access
            stored data. Keep production credentials private and restricted.
          </p>
        </section>
      </div>
    </main>
  );
}