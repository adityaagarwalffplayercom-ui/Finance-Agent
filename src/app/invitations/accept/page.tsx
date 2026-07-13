"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function InvitationLoadingState() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        className="section-card"
        style={{
          width: "min(560px, 100%)",
          display: "grid",
          gap: 18,
        }}
      >
        <p className="eyebrow" style={{ margin: 0 }}>
          Workspace invitation
        </p>

        <h1 style={{ margin: 0 }}>Accepting invitation</h1>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            lineHeight: 1.65,
          }}
        >
          Checking your invitation…
        </p>
      </section>
    </main>
  );
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [message, setMessage] = useState(
    "Checking your invitation…",
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage("The invitation link is missing its token.");
      return;
    }

    void fetch("/api/workspace-invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = (await response
          .json()
          .catch(() => ({}))) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Invitation could not be accepted.",
          );
        }

        setSuccess(true);
        setMessage(
          "Invitation accepted. Your workspace is ready.",
        );
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Invitation could not be accepted.",
        );
      });
  }, [token]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        className="section-card"
        style={{
          width: "min(560px, 100%)",
          display: "grid",
          gap: 18,
        }}
      >
        <p className="eyebrow" style={{ margin: 0 }}>
          Workspace invitation
        </p>

        <h1 style={{ margin: 0 }}>
          {success
            ? "Welcome to the team"
            : "Accepting invitation"}
        </h1>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            lineHeight: 1.65,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            className="button-primary"
            href={success ? "/dashboard" : "/sign-in"}
          >
            {success ? "Open dashboard" : "Sign in"}
          </Link>

          <Link className="button-secondary" href="/">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<InvitationLoadingState />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
