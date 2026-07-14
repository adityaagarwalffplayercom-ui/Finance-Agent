"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AureliLogo } from "@/components/AureliLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      } as never);
      if ((result as { error?: { message?: string } }).error) {
        throw new Error((result as { error: { message?: string } }).error.message ?? "Reset request failed.");
      }
      setMessage("If an Actic Finance account exists for this email, a reset link has been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="section-card" style={{ width: "min(480px, 100%)", display: "grid", gap: 18 }}>
        <span style={{ width: 54, height: 54 }}><AureliLogo /></span>
        <div><p className="eyebrow" style={{ margin: 0 }}>Account recovery</p><h1 style={{ margin: "8px 0 0" }}>Reset password</h1></div>
        <p className="page-intro">Enter your account email. For privacy, Actic Finance always returns the same response.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="button-primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
        {message && <p style={{ margin: 0, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{message}</p>}
        <Link href="/sign-in">Back to sign in</Link>
      </section>
    </main>
  );
}
