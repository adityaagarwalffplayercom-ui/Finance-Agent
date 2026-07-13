"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return setMessage("This reset link is missing or invalid.");
    if (password.length < 10) return setMessage("Use at least 10 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setBusy(true);
    setMessage(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token } as never);
      if ((result as { error?: { message?: string } }).error) {
        throw new Error((result as { error: { message?: string } }).error.message ?? "Password reset failed.");
      }
      setSuccess(true);
      setMessage("Password changed. Other sessions were revoked for security.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="section-card" style={{ width: "min(480px, 100%)", display: "grid", gap: 18 }}>
        <div><p className="eyebrow" style={{ margin: 0 }}>Secure recovery</p><h1 style={{ margin: "8px 0 0" }}>Choose a new password</h1></div>
        {!success && <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <input type="password" required minLength={10} autoComplete="new-password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <input type="password" required minLength={10} autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          <button className="button-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>}
        {message && <p style={{ margin: 0, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{message}</p>}
        <Link href="/sign-in">{success ? "Sign in with new password" : "Back to sign in"}</Link>
      </section>
    </main>
  );
}
