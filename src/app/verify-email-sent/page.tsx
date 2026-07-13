"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function VerifyEmailSentPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("Check your inbox and open the verification link.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get("email") ?? "");
  }, []);

  async function resend(event: FormEvent) {
    event.preventDefault();
    if (!email) return setMessage("Enter the email used for your Aureli account.");
    setBusy(true);
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" } as never);
      if ((result as { error?: { message?: string } }).error) {
        throw new Error((result as { error: { message?: string } }).error.message ?? "Verification email failed.");
      }
      setMessage("A new verification email was sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification email failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="section-card" style={{ width: "min(500px, 100%)", display: "grid", gap: 18 }}>
        <div><p className="eyebrow" style={{ margin: 0 }}>Email verification</p><h1 style={{ margin: "8px 0 0" }}>Verify your account</h1></div>
        <p className="page-intro">{message}</p>
        <form onSubmit={resend} style={{ display: "grid", gap: 12 }}>
          <input type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="button-primary" disabled={busy}>{busy ? "Sending…" : "Resend verification email"}</button>
        </form>
        <Link href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
