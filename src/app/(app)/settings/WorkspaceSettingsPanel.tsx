"use client";

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
  availableWorkspaces: Array<{ id: string; name: string; plan: string; role: string }>;
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
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
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
  const [retentionDays, setRetentionDays] = useState(String(workspace.retentionDays));
  const [aiConsent, setAiConsent] = useState(Boolean(workspace.aiProcessingConsentAt));
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
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Workspace switch failed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace switch failed.");
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
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Settings update failed.");
      setMessage("Workspace settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        invitation?: unknown;
      };
      if (!response.ok) throw new Error(data.error ?? "Member could not be added.");
      setEmail("");
      setMessage(data.invitation ? "Invitation email sent." : "Workspace member added.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Member could not be added.");
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
        `/api/workspaces/${workspace.id}/members?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Member could not be removed.");
      setMessage("Workspace member removed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Member could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section className="section-card" style={{ display: "grid", gap: 12 }}>
        <div>
          <p className="section-title">Active workspace</p>
          <p className="section-hint">Choose which business workspace powers documents, limits and finance views.</p>
        </div>
        <select
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
      <section className="section-card" style={{ display: "grid", gap: 18 }}>
        <div>
          <p className="section-title">Workspace controls</p>
          <p className="section-hint">Consent, retention and workspace identity used by document processing.</p>
        </div>
        <form onSubmit={saveSettings} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}>
            <span className="section-hint">Workspace name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canAdmin} />
          </label>
          <label style={{ display: "grid", gap: 7 }}>
            <span className="section-hint">Document retention in days</span>
            <input type="number" min={1} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} disabled={!canAdmin} />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} disabled={!canAdmin} />
            <span>I consent to sending document content to configured AI providers when deterministic extraction is insufficient.</span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} disabled={!canAdmin} />
            <span>I accept the workspace terms and understand that Aureli provides decision support, not statutory accounting advice.</span>
          </label>
          {canAdmin && <button className="button-primary" disabled={busy}>Save settings</button>}
        </form>
      </section>

      <section className="section-card" style={{ display: "grid", gap: 16 }}>
        <div>
          <p className="section-title">Plan and usage</p>
          <p className="section-hint">Current monthly usage is recorded persistently for quota and cost controls.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            ["Plan", workspace.plan],
            ["Uploads", String(usage?.uploads ?? 0)],
            ["AI processes", String(usage?.aiProcesses ?? 0)],
            ["Pages", String(usage?.processedPages ?? 0)],
            ["Current storage", formatBytes(usage?.currentStorageBytes ?? "0")],
            ["Uploaded this month", formatBytes(usage?.storageBytes ?? "0")],
            ["Estimated AI cost", `$${(Number(usage?.estimatedCostMicros ?? 0) / 1_000_000).toFixed(4)}`],
          ].map(([label, value]) => (
            <div key={label} style={{ border: "1px solid var(--color-border)", borderRadius: 14, padding: 14 }}>
              <span className="section-hint">{label}</span>
              <strong style={{ display: "block", marginTop: 6 }}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card" style={{ display: "grid", gap: 16 }}>
        <div>
          <p className="section-title">Team access</p>
          <p className="section-hint">Invite accountants, analysts, auditors and viewers with role-based access.</p>
        </div>
        {canAdmin && (
          <form onSubmit={addMember} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 180px auto", gap: 10 }}>
            <input type="email" required placeholder="member@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="ADMIN">Admin</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="ANALYST">Analyst</option>
              <option value="AUDITOR">Auditor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button className="button-primary" disabled={busy}>Add or invite</button>
          </form>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {members.map((member) => (
            <div key={member.id} style={{ border: "1px solid var(--color-border)", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>{member.user.name}</strong>
                <span className="section-hint" style={{ display: "block" }}>{member.user.email} · {member.role}</span>
              </div>
              {canAdmin && member.role !== "OWNER" && (
                <button type="button" className="button-secondary" disabled={busy} onClick={() => removeMember(member.userId)}>Remove</button>
              )}
            </div>
          ))}
          {invitations.map((invitation) => (
            <div key={invitation.id} style={{ border: "1px dashed var(--color-border)", borderRadius: 14, padding: 12 }}>
              <strong>{invitation.email}</strong>
              <span className="section-hint" style={{ display: "block" }}>Pending {invitation.role} invitation · expires {new Date(invitation.expiresAt).toLocaleDateString("en-IN")}</span>
            </div>
          ))}
        </div>
      </section>

      {message && <div className="section-card" style={{ color: "var(--color-text-secondary)" }}>{message}</div>}
    </div>
  );
}
