"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildLearningFeedbackEvent,
  optimizeActionsWithLearning,
  summarizeLearningFeedback,
  type LearningFeedbackEvent,
  type LearningOptimizedAction,
  type LearningRewardType,
} from "@/lib/learning-feedback-engine";

type DecisionAction = {
  id: string;
  priority: string;
  category: string;
  title: string;
  problem: string;
  action: string;
  expectedImpact: string;
  timeframe: string;
  confidence: string;
};

type DecisionReport = {
  executiveSummary: string;
  ownerFocus: string;
  overallStatus: string;
  score: number;
  topActions: DecisionAction[];
};

type Tone = "good" | "warning" | "danger" | "neutral";

const STORAGE_KEY = "aureli-learning-feedback-v1";

function toneStyle(tone: Tone) {
  return {
    good: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
    },
    warning: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
    },
    danger: {
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
    },
  }[tone];
}

function priorityTone(priority: string): Tone {
  const clean = priority.toUpperCase();

  if (clean === "CRITICAL") return "danger";
  if (clean === "HIGH") return "danger";
  if (clean === "MEDIUM") return "warning";

  return "good";
}

function rewardLabel(type: LearningRewardType) {
  if (type === "HELPFUL") return "Helpful";
  if (type === "NOT_HELPFUL") return "Not helpful";
  if (type === "ACCEPTED") return "Accepted";
  return "Completed";
}

function rewardTone(type: LearningRewardType): Tone {
  if (type === "NOT_HELPFUL") return "danger";
  if (type === "COMPLETED") return "good";
  if (type === "ACCEPTED") return "good";
  return "warning";
}

function loadStoredFeedback() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as LearningFeedbackEvent[];
  } catch {
    return [];
  }
}

function saveStoredFeedback(feedback: LearningFeedbackEvent[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(feedback));
}

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 11,
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: "clamp(24px, 3vw, 34px)",
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.06em",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 800,
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function RewardButton({
  type,
  onClick,
}: {
  type: LearningRewardType;
  onClick: () => void;
}) {
  const style = toneStyle(rewardTone(type));

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {rewardLabel(type)}
    </button>
  );
}

function ActionCard({
  action,
  onReward,
}: {
  action: LearningOptimizedAction;
  onReward: (type: LearningRewardType) => void;
}) {
  const style = toneStyle(priorityTone(action.priority ?? "LOW"));

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 12,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: style.color,
            border: `1px solid ${style.border}`,
            background: style.background,
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: "0.08em",
          }}
        >
          {action.priority} - {action.timeframe}
        </span>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          Rank {action.originalRank} → Score {Math.round(action.optimizedScore)}
        </span>
      </div>

      <h3
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 20,
          lineHeight: 1.2,
        }}
      >
        {action.title}
      </h3>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        <strong style={{ color: "var(--color-text-primary)" }}>Action:</strong>{" "}
        {action.action ?? "Follow this recommendation from Decision Center."}
      </p>

      <p
        style={{
          margin: 0,
          color: style.color,
          fontSize: 13,
          lineHeight: 1.6,
          fontWeight: 850,
        }}
      >
        {action.learningLabel} · Reward score {action.rewardScore}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <RewardButton type="HELPFUL" onClick={() => onReward("HELPFUL")} />
        <RewardButton type="NOT_HELPFUL" onClick={() => onReward("NOT_HELPFUL")} />
        <RewardButton type="ACCEPTED" onClick={() => onReward("ACCEPTED")} />
        <RewardButton type="COMPLETED" onClick={() => onReward("COMPLETED")} />
      </div>
    </article>
  );
}

export default function LearningCenterPage() {
  const [report, setReport] = useState<DecisionReport | null>(null);
  const [feedback, setFeedback] = useState<LearningFeedbackEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setFeedback(loadStoredFeedback());

    async function loadDecisionCenter() {
      try {
        const response = await fetch("/api/decision-center", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load decision center.");
        }

        setReport(data.report);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load learning center.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadDecisionCenter();
  }, []);

  const summary = useMemo(() => summarizeLearningFeedback(feedback), [feedback]);

  const optimizedActions = useMemo(() => {
    return optimizeActionsWithLearning({
      actions: report?.topActions ?? [],
      feedback,
    });
  }, [report?.topActions, feedback]);

  function addFeedback(
    action: { id: string; title: string; category: string },
    rewardType: LearningRewardType,
  ) {
    const event = buildLearningFeedbackEvent({
      actionId: action.id,
      actionTitle: action.title,
      category: action.category,
      rewardType,
    });

    const nextFeedback = [event, ...feedback].slice(0, 100);

    setFeedback(nextFeedback);
    saveStoredFeedback(nextFeedback);
  }

  function resetLearning() {
    setFeedback([]);
    saveStoredFeedback([]);
  }

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.10), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
          borderRadius: 30,
          padding: 26,
          display: "grid",
          gap: 18,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Reinforcement Learning Loop
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 960,
              }}
            >
              Learning Center.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              Aureli learns from user feedback. Helpful, accepted, and completed
              actions get rewarded, while unhelpful actions reduce future ranking.
            </p>
          </div>

          <button
            type="button"
            onClick={resetLearning}
            className="btn-ghost"
            style={{ cursor: "pointer" }}
          >
            Reset learning
          </button>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          <MetricCard
            label="Learning score"
            value={`${summary.learningScore}/100`}
            hint={`${summary.totalFeedback} feedback signal(s)`}
            tone={
              summary.learningScore >= 70
                ? "good"
                : summary.learningScore >= 40
                  ? "warning"
                  : summary.totalFeedback > 0
                    ? "danger"
                    : "neutral"
            }
          />

          <MetricCard
            label="Completed actions"
            value={`${summary.completedCount}`}
            hint="Strongest positive reward"
            tone={summary.completedCount > 0 ? "good" : "neutral"}
          />

          <MetricCard
            label="Best category"
            value={summary.bestCategory}
            hint="Highest reward area"
            tone={summary.totalFeedback > 0 ? "good" : "neutral"}
          />

          <MetricCard
            label="Weak category"
            value={summary.weakestCategory}
            hint="Lowest reward area"
            tone={summary.totalFeedback > 0 ? "warning" : "neutral"}
          />
        </div>

        {isLoading ? (
          <section className="section-card" style={{ padding: 22 }}>
            <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
              Loading Decision Center recommendations...
            </p>
          </section>
        ) : error ? (
          <section className="section-card" style={{ padding: 22 }}>
            <p style={{ margin: 0, color: "var(--color-danger)" }}>{error}</p>
          </section>
        ) : (
          <>
            <section
              className="section-card"
              style={{
                padding: 22,
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  Optimized recommendations
                </p>

                <h2
                  style={{
                    margin: "8px 0 0",
                    color: "var(--color-text-primary)",
                    fontSize: 24,
                    lineHeight: 1.15,
                  }}
                >
                  Actions re-ranked by feedback rewards
                </h2>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  Original Decision Center score: {report?.score}/100 · Focus:{" "}
                  {report?.ownerFocus}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {optimizedActions.slice(0, 6).map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onReward={(rewardType) => addFeedback(action, rewardType)}
                  />
                ))}
              </div>
            </section>

            <section
              className="section-card"
              style={{
                padding: 22,
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>
                  Reward history
                </p>

                <h2
                  style={{
                    margin: "8px 0 0",
                    color: "var(--color-text-primary)",
                    fontSize: 24,
                    lineHeight: 1.15,
                  }}
                >
                  Latest user feedback
                </h2>
              </div>

              {feedback.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {feedback.slice(0, 12).map((event) => {
                    const style = toneStyle(rewardTone(event.rewardType));

                    return (
                      <article
                        key={event.id}
                        style={{
                          border: `1px solid ${style.border}`,
                          background: style.background,
                          borderRadius: 16,
                          padding: 13,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <strong
                          style={{
                            color: "var(--color-text-primary)",
                            fontSize: 14,
                            lineHeight: 1.35,
                          }}
                        >
                          {event.actionTitle}
                        </strong>

                        <span
                          style={{
                            color: style.color,
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          {event.rewardType} · Reward {event.rewardValue} ·{" "}
                          {event.category}
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  No feedback yet. Click Helpful, Accepted, or Completed on any
                  recommendation to train the optimizer.
                </p>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

