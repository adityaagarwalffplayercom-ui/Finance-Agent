"use client";

// AURELI_SETTINGS_INTEGRATION_V4

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  userId: string;
  role: string;
  user: { name: string; email: string; emailVerified: boolean };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

type Props = {
  workspace: {
    id: string;
    name: string;
    plan: string;
    retentionDays: number;
    aiProcessingConsentAt: string | null;
    termsAcceptedAt: string | null;
  };
  currentRole: string;
  availableWorkspaces: Array<{
    id: string;
    name: string;
    plan: string;
    role: string;
  }>;
  members: Member[];
  invitations: Invitation[];
  usage: {
    uploads: number;
    aiProcesses: number;
    processedPages: number;
    storageBytes: string;
    currentStorageBytes: string;
    estimatedCostMicros: string;
  } | null;
};

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";

  return `${(bytes / 1024 / 1024).toFixed(
    bytes >= 10 * 1024 * 1024 ? 0 : 1,
  )} MB`;
}

export function WorkspaceSettingsPanel({
  workspace,
  currentRole,
  availableWorkspaces,
  members,
  invitations,
  usage,
}: Props) {
  const router = useRouter();
  const canAdmin = currentRole === "OWNER" || currentRole === "ADMIN";
  const [name, setName] = useState(workspace.name);
  const [retentionDays, setRetentionDays] = useState(
    String(workspace.retentionDays),
  );
  const [aiConsent, setAiConsent] = useState(
    Boolean(workspace.aiProcessingConsentAt),
  );
  const [terms, setTerms] = useState(Boolean(workspace.termsAcceptedAt));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ACCOUNTANT");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === workspace.id || busy) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/workspaces/active", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Workspace switch failed.");
      }

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Workspace switch failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name,
          retentionDays: Number(retentionDays),
          acceptAiProcessing: aiConsent,
          acceptTerms: terms,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Settings update failed.");
      }

      setMessage("Workspace settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Settings update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/members`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, role }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        invitation?: unknown;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Member could not be added.");
      }

      setEmail("");
      setMessage(
        data.invitation
          ? "Invitation email sent."
          : "Workspace member added.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Member could not be added.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this member from the workspace?")) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/members?userId=${encodeURIComponent(
          userId,
        )}`,
        { method: "DELETE" },
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Member could not be removed.");
      }

      setMessage("Workspace member removed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Member could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const usageItems = [
    ["Plan", workspace.plan],
    ["Uploads", String(usage?.uploads ?? 0)],
    ["AI processes", String(usage?.aiProcesses ?? 0)],
    ["Pages", String(usage?.processedPages ?? 0)],
    ["Current storage", formatBytes(usage?.currentStorageBytes ?? "0")],
    ["Uploaded this month", formatBytes(usage?.storageBytes ?? "0")],
    [
      "Estimated AI cost",
      `$${(
        Number(usage?.estimatedCostMicros ?? 0) / 1_000_000
      ).toFixed(4)}`,
    ],
  ];

  return (
    <div className="aureli-settings-panel">
      <section className="section-card settings-card settings-active-card">
        <div className="settings-card-heading">
          <p className="section-title">Active workspace</p>
          <p className="section-hint">
            Choose which business workspace powers documents, limits and
            finance views.
          </p>
        </div>

        <select
          className="settings-control"
          value={workspace.id}
          disabled={busy}
          onChange={(event) => void switchWorkspace(event.target.value)}
        >
          {availableWorkspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.role} · {item.plan}
            </option>
          ))}
        </select>
      </section>

      <section className="section-card settings-card settings-controls-card">
        <div className="settings-card-heading">
          <p className="section-title">Workspace controls</p>
          <p className="section-hint">
            Consent, retention and workspace identity used by document
            processing.
          </p>
        </div>

        <form className="settings-form" onSubmit={saveSettings}>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span className="section-hint">Workspace name</span>
              <input
                className="settings-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canAdmin || busy}
              />
            </label>

            <label className="settings-field">
              <span className="section-hint">
                Document retention in days
              </span>
              <input
                className="settings-control"
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                onChange={(event) =>
                  setRetentionDays(event.target.value)
                }
                disabled={!canAdmin || busy}
              />
            </label>
          </div>

          <div className="settings-consent-list">
            <label className="settings-check-row">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(event) => setAiConsent(event.target.checked)}
                disabled={!canAdmin || busy}
              />
              <span>
                I consent to sending document content to configured AI
                providers when deterministic extraction is insufficient.
              </span>
            </label>

            <label className="settings-check-row">
              <input
                type="checkbox"
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
                disabled={!canAdmin || busy}
              />
              <span>
                I accept the workspace terms and understand that Aureli
                provides decision support, not statutory accounting advice.
              </span>
            </label>
          </div>

          {canAdmin && (
            <button
              className="settings-primary-button"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving..." : "Save settings"}
            </button>
          )}
        </form>
      </section>

      <section className="section-card settings-card settings-usage-card">
        <div className="settings-card-heading">
          <p className="section-title">Plan and usage</p>
          <p className="section-hint">
            Current monthly usage is recorded persistently for quota and cost
            controls.
          </p>
        </div>

        <div className="settings-usage-grid">
          {usageItems.map(([label, value]) => (
            <div className="settings-usage-item" key={label}>
              <span className="section-hint">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card settings-card settings-team-card">
        <div className="settings-card-heading">
          <p className="section-title">Team access</p>
          <p className="section-hint">
            Invite accountants, analysts, auditors and viewers with role-based
            access.
          </p>
        </div>

        {canAdmin && (
          <form className="settings-team-form" onSubmit={addMember}>
            <input
              className="settings-control"
              type="email"
              required
              placeholder="member@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />

            <select
              className="settings-control"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={busy}
            >
              <option value="ADMIN">Admin</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="ANALYST">Analyst</option>
              <option value="AUDITOR">Auditor</option>
              <option value="VIEWER">Viewer</option>
            </select>

            <button
              className="settings-primary-button"
              type="submit"
              disabled={busy}
            >
              {busy ? "Working..." : "Add or invite"}
            </button>
          </form>
        )}

        <div className="settings-members-list">
          {members.map((member) => (
            <div className="settings-member-row" key={member.id}>
              <div className="settings-member-copy">
                <strong>{member.user.name || "Aureli member"}</strong>
                <span className="section-hint">
                  {member.user.email} · {member.role}
                </span>
              </div>

              {canAdmin && member.role !== "OWNER" && (
                <button
                  className="settings-secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void removeMember(member.userId)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          {invitations.map((invitation) => (
            <div
              className="settings-member-row settings-invitation-row"
              key={invitation.id}
            >
              <div className="settings-member-copy">
                <strong>{invitation.email}</strong>
                <span className="section-hint">
                  Pending {invitation.role} invitation · expires{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString("en-IN")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {message && (
        <div className="section-card settings-message" role="status">
          {message}
        </div>
      )}

      <style jsx global>{`
        /* Route-level shell authority. This fixes conflicting legacy rules
           without changing any other application page. */
        @media (min-width: 981px) {
          html,
          body {
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
          }

          .dashboard-shell {
            display: block !important;
            width: 100vw !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            padding: 16px !important;
            overflow: hidden !important;
          }

          .dashboard-shell > .sidebar {
            position: fixed !important;
            inset: 16px auto 16px 16px !important;
            width: 280px !important;
            height: calc(100dvh - 32px) !important;
            max-height: calc(100dvh - 32px) !important;
            margin: 0 !important;
            z-index: 50 !important;
          }

          .dashboard-shell > .dashboard-main {
            position: relative !important;
            inset: auto !important;
            width: calc(100vw - 332px) !important;
            max-width: none !important;
            height: calc(100dvh - 32px) !important;
            max-height: calc(100dvh - 32px) !important;
            margin: 0 0 0 300px !important;
            padding: 28px !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
          }
        }

        .dashboard-header {
          min-height: 0 !important;
          margin-bottom: 18px !important;
          padding: 22px 24px !important;
          align-items: flex-start !important;
          border: 1px solid var(--neutral-border) !important;
          border-radius: var(--neutral-radius-xl) !important;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.052),
              rgba(255, 255, 255, 0.026)
            ) !important;
          box-shadow: var(--neutral-shadow) !important;
          backdrop-filter: blur(16px) saturate(1.05) !important;
          -webkit-backdrop-filter: blur(16px) saturate(1.05) !important;
        }

        .dashboard-header .page-intro {
          margin: 8px 0 0 !important;
          max-width: 720px !important;
          line-height: 1.55 !important;
        }

        .dashboard-main > .aureli-settings-panel {
          display: grid !important;
          grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr) !important;
          grid-template-areas:
            "active active"
            "controls usage"
            "team team"
            "message message" !important;
          gap: 20px !important;
          width: 100% !important;
          min-width: 0 !important;
          align-items: start !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          overflow: visible !important;
        }

        .aureli-settings-panel .settings-card {
          display: grid !important;
          gap: 18px !important;
          width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          padding: 20px !important;
          overflow: hidden !important;
          border: 1px solid var(--neutral-border) !important;
          border-radius: var(--neutral-radius-xl) !important;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.052),
              rgba(255, 255, 255, 0.026)
            ) !important;
          box-shadow: var(--neutral-shadow) !important;
          backdrop-filter: blur(16px) saturate(1.05) !important;
          -webkit-backdrop-filter: blur(16px) saturate(1.05) !important;
        }

        .aureli-settings-panel .settings-card::before {
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.055),
              transparent 44%
            ) !important;
          opacity: 0.38 !important;
        }

        .aureli-settings-panel .settings-active-card {
          grid-area: active !important;
        }

        .aureli-settings-panel .settings-controls-card {
          grid-area: controls !important;
        }

        .aureli-settings-panel .settings-usage-card {
          grid-area: usage !important;
        }

        .aureli-settings-panel .settings-team-card {
          grid-area: team !important;
        }

        .aureli-settings-panel .settings-message {
          grid-area: message !important;
          margin: 0 !important;
          padding: 14px 16px !important;
          color: var(--color-text-secondary) !important;
        }

        .dashboard-main .aureli-settings-panel .settings-card-heading {
          display: grid !important;
          gap: 4px !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          overflow: visible !important;
        }

        .aureli-settings-panel .settings-card-heading p {
          margin: 0 !important;
        }

        .aureli-settings-panel form,
        .aureli-settings-panel .settings-form,
        .aureli-settings-panel .settings-team-form {
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          min-width: 0 !important;
          max-width: none !important;
        }

        .aureli-settings-panel .settings-form {
          display: grid !important;
          gap: 16px !important;
        }

        .aureli-settings-panel .settings-field-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 12px !important;
          min-width: 0 !important;
        }

        .aureli-settings-panel .settings-field {
          display: grid !important;
          gap: 7px !important;
          min-width: 0 !important;
        }

        .aureli-settings-panel .settings-control {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 44px !important;
          height: 44px !important;
          margin: 0 !important;
          padding: 0 13px !important;
          border: 1px solid var(--neutral-border) !important;
          border-radius: var(--neutral-radius-md) !important;
          background: rgba(255, 255, 255, 0.032) !important;
          color: var(--neutral-text) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.028) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          font-size: 13px !important;
          line-height: 1.2 !important;
          box-sizing: border-box !important;
        }

        .aureli-settings-panel .settings-control:focus {
          border-color: var(--neutral-border-strong) !important;
          box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.055),
            inset 0 1px 0 rgba(255, 255, 255, 0.028) !important;
        }

        .aureli-settings-panel .settings-consent-list {
          display: grid !important;
          gap: 10px !important;
        }

        .aureli-settings-panel .settings-check-row {
          display: grid !important;
          grid-template-columns: 18px minmax(0, 1fr) !important;
          gap: 10px !important;
          align-items: start !important;
          margin: 0 !important;
          line-height: 1.5 !important;
          min-width: 0 !important;
        }

        .aureli-settings-panel .settings-check-row input[type="checkbox"] {
          appearance: auto !important;
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
          height: 16px !important;
          min-height: 16px !important;
          max-height: 16px !important;
          margin: 3px 0 0 !important;
          padding: 0 !important;
          border-radius: 3px !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }

        .aureli-settings-panel .settings-primary-button,
        .aureli-settings-panel .settings-secondary-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: auto !important;
          min-width: 0 !important;
          max-width: 100% !important;
          min-height: 42px !important;
          height: 42px !important;
          margin: 0 !important;
          padding: 0 17px !important;
          border-radius: 12px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          cursor: pointer !important;
        }

        .aureli-settings-panel .settings-primary-button {
          justify-self: start !important;
          border: 1px solid var(--neutral-border-strong) !important;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.84),
              rgba(235, 238, 245, 0.72)
            ) !important;
          color: #0b0d11 !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16) !important;
        }

        .aureli-settings-panel .settings-primary-button:hover:not(:disabled) {
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.92),
              rgba(235, 238, 245, 0.82)
            ) !important;
          border-color: rgba(255, 255, 255, 0.22) !important;
        }

        .aureli-settings-panel .settings-secondary-button {
          flex: 0 0 auto !important;
          border: 1px solid var(--neutral-border) !important;
          background: rgba(255, 255, 255, 0.038) !important;
          color: var(--neutral-text) !important;
          box-shadow: none !important;
        }

        .aureli-settings-panel .settings-usage-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          min-width: 0 !important;
        }

        .aureli-settings-panel .settings-usage-item {
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          gap: 8px !important;
          min-width: 0 !important;
          min-height: 76px !important;
          padding: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.075) !important;
          border-radius: var(--neutral-radius-md) !important;
          background: rgba(255, 255, 255, 0.018) !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .aureli-settings-panel .settings-usage-item strong {
          display: block !important;
          overflow-wrap: anywhere !important;
        }

        .aureli-settings-panel .settings-team-form {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 180px 150px !important;
          gap: 10px !important;
          align-items: center !important;
        }

        .aureli-settings-panel .settings-team-form .settings-primary-button {
          width: 100% !important;
          justify-self: stretch !important;
        }

        .aureli-settings-panel .settings-members-list {
          display: grid !important;
          gap: 9px !important;
          min-width: 0 !important;
        }

        .aureli-settings-panel .settings-member-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 14px !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 64px !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(255, 255, 255, 0.075) !important;
          border-radius: var(--neutral-radius-md) !important;
          background: rgba(255, 255, 255, 0.018) !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .aureli-settings-panel .settings-member-copy {
          display: grid !important;
          gap: 4px !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
        }

        .aureli-settings-panel .settings-member-copy strong,
        .aureli-settings-panel .settings-member-copy span {
          min-width: 0 !important;
          overflow-wrap: anywhere !important;
        }

        .aureli-settings-panel .settings-invitation-row {
          border-style: dashed !important;
        }

        @media (max-width: 1180px) {
          .dashboard-main > .aureli-settings-panel {
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-areas:
              "active"
              "controls"
              "usage"
              "team"
              "message" !important;
          }
        }

        @media (max-width: 980px) {
          html,
          body {
            height: auto !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
          }

          .dashboard-shell {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100dvh !important;
            padding: 10px !important;
            overflow: visible !important;
          }

          .dashboard-shell > .sidebar {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 0 12px !important;
          }

          .dashboard-shell > .dashboard-main {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-header {
            padding: 18px !important;
          }

          .dashboard-main > .aureli-settings-panel {
            gap: 14px !important;
          }

          .aureli-settings-panel .settings-card {
            gap: 15px !important;
            padding: 16px !important;
          }

          .aureli-settings-panel .settings-field-grid,
          .aureli-settings-panel .settings-team-form,
          .aureli-settings-panel .settings-usage-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .aureli-settings-panel .settings-primary-button,
          .aureli-settings-panel .settings-secondary-button {
            width: 100% !important;
            justify-self: stretch !important;
          }

          .aureli-settings-panel .settings-member-row {
            align-items: stretch !important;
            flex-direction: column !important;
          }
        }

        @media print {
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .dashboard-shell {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .dashboard-shell > .sidebar {
            display: none !important;
          }

          .dashboard-shell > .dashboard-main {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            color: #111827 !important;
          }

          .dashboard-header,
          .aureli-settings-panel .settings-card,
          .aureli-settings-panel .settings-message {
            break-inside: avoid !important;
            border: 1px solid #d1d5db !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }

          .dashboard-main > .aureli-settings-panel {
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-areas:
              "active"
              "controls"
              "usage"
              "team"
              "message" !important;
            gap: 12px !important;
          }

          .aureli-settings-panel .settings-control,
          .aureli-settings-panel .settings-usage-item,
          .aureli-settings-panel .settings-member-row {
            border-color: #d1d5db !important;
            background: #ffffff !important;
            color: #111827 !important;
          }

          .aureli-settings-panel .section-hint,
          .dashboard-header .page-intro {
            color: #4b5563 !important;
          }

          .aureli-settings-panel button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
