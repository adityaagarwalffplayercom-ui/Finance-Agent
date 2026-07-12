"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AureliLogo } from "@/components/AureliLogo";

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setError("");

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      } as any);

      if ((result as any)?.error) {
        throw new Error(
          (result as any).error.message || "Sign in failed. Please try again.",
        );
      }

      router.push("/dashboard");
      router.refresh();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "clamp(20px, 4vw, 54px)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <section
        style={{
          width: "min(1080px, 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(360px, 0.68fr)",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <aside
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.060), rgba(255,255,255,0.030))",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            borderRadius: 34,
            padding: "clamp(28px, 4vw, 50px)",
            boxShadow: "0 16px 44px rgba(0,0,0,0.16)",
            display: "grid",
            alignContent: "space-between",
            gap: 28,
          }}
        >
          <div>
            <Link
              href="/"
              style={{
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
                fontWeight: 950,
                fontSize: 26,
                letterSpacing: "-0.05em",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 15,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.040)",
                  overflow: "hidden",
                }}
              >
                <AureliLogo />
              </span>
              Aureli
            </Link>

            <p className="eyebrow" style={{ margin: "36px 0 0" }}>
              Secure finance workspace
            </p>

            <h1
              style={{
                margin: "14px 0 0",
                color: "rgba(255,255,255,0.95)",
                fontSize: "clamp(42px, 6vw, 76px)",
                lineHeight: 0.94,
                letterSpacing: "-0.085em",
              }}
            >
              Continue your executive finance flow.
            </h1>

            <p
              style={{
                margin: "20px 0 0",
                color: "rgba(235,238,245,0.58)",
                fontSize: 16,
                lineHeight: 1.75,
                maxWidth: 620,
              }}
            >
              Access your dashboard, approved documents, AI agents, forecasts,
              risk score, and decision center from one minimal workspace.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {[
              ["CFO", "Decisions"],
              ["Risk", "Score"],
              ["Cash", "Runway"],
              ["AI", "Team"],
            ].map(([top, bottom]) => (
              <div
                key={top}
                style={{
                  border: "1px solid rgba(255,255,255,0.075)",
                  background: "rgba(255,255,255,0.034)",
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "rgba(255,255,255,0.88)",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  {top}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: 6,
                    color: "rgba(235,238,245,0.44)",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {bottom}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.088), rgba(255,255,255,0.040))",
            backdropFilter: "blur(22px) saturate(1.08)",
            WebkitBackdropFilter: "blur(22px) saturate(1.08)",
            borderRadius: 34,
            padding: 16,
            boxShadow: "0 18px 52px rgba(0,0,0,0.18)",
            display: "grid",
            alignContent: "center",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.085)",
              background: "rgba(255,255,255,0.034)",
              borderRadius: 28,
              padding: "clamp(22px, 4vw, 34px)",
            }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                gap: 14,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.045)",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                <AureliLogo />
              </span>

              <div>
                <p
                  style={{
                    margin: 0,
                    color: "rgba(235,238,245,0.46)",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                  }}
                >
                  Sign in
                </p>

                <h2
                  style={{
                    margin: "8px 0 0",
                    color: "rgba(255,255,255,0.94)",
                    fontSize: 38,
                    lineHeight: 1,
                    letterSpacing: "-0.06em",
                  }}
                >
                  Enter Aureli
                </h2>

                <p
                  style={{
                    margin: "12px auto 0",
                    color: "rgba(235,238,245,0.54)",
                    fontSize: 14,
                    lineHeight: 1.65,
                    maxWidth: 320,
                  }}
                >
                  Sign in to continue managing your business finances.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: 8,
                  color: "rgba(235,238,245,0.64)",
                  fontSize: 13,
                  fontWeight: 850,
                }}
              >
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "15px 16px",
                    fontSize: 15,
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: 8,
                  color: "rgba(235,238,245,0.64)",
                  fontSize: 13,
                  fontWeight: 850,
                }}
              >
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "15px 16px",
                    fontSize: 15,
                  }}
                />
              </label>

              {error ? (
                <div
                  style={{
                    border: "1px solid rgba(255,154,167,0.24)",
                    background: "rgba(255,154,167,0.070)",
                    color: "rgba(255,190,198,0.94)",
                    borderRadius: 16,
                    padding: 12,
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: 750,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-ghost"
                style={{
                  width: "100%",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.68 : 1,
                  marginTop: 4,
                  padding: "13px 16px",
                }}
              >
                {isLoading ? "Signing in..." : "Sign in to workspace"}
              </button>
            </form>

            <div
              style={{
                margin: "22px 0",
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.13), transparent)",
              }}
            />

            <div
              style={{
                display: "grid",
                gap: 10,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "rgba(235,238,245,0.50)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                New to Aureli?{" "}
                <Link
                  href="/sign-up"
                  style={{
                    color: "rgba(255,255,255,0.86)",
                    fontWeight: 850,
                    textDecoration: "none",
                  }}
                >
                  Create account
                </Link>
              </p>

              <Link
                href="/demo"
                style={{
                  color: "rgba(235,238,245,0.52)",
                  fontSize: 13,
                  textDecoration: "none",
                  fontWeight: 750,
                }}
              >
                Explore user demo instead
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
