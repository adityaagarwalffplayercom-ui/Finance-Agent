"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type AgentId =
  | "team"
  | "cfo"
  | "accountant"
  | "tax"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type AgentUiConfig = {
  name: string;
  title: string;
  eyebrow: string;
  placeholder: string;
  intro: string;
  accent: string;
};

const AGENTS: Record<AgentId, AgentUiConfig> = {
  team: {
    name: "AI Finance Team",
    title: "Ask your business anything.",
    eyebrow: "AI finance team",
    placeholder: "Ask: Why is my business running at a loss?",
    intro:
      "Hi, I am your AI finance team. Ask me about revenue, expenses, profit, cash flow, tax, risks, or next actions.",
    accent: "#8abfff",
  },
  cfo: {
    name: "CFO Agent",
    title: "Ask the CFO Agent.",
    eyebrow: "Executive decision support",
    placeholder: "Ask: What should I fix first as the owner?",
    intro:
      "Hi, I am your CFO Agent. I focus on health score, profitability, risk, runway, and executive decisions.",
    accent: "#7bed9f",
  },
  accountant: {
    name: "Accountant Agent",
    title: "Ask the Accountant Agent.",
    eyebrow: "Books and document control",
    placeholder: "Ask: Which documents are missing?",
    intro:
      "Hi, I am your Accountant Agent. I focus on document quality, missing records, categorization, and data reliability.",
    accent: "#8abfff",
  },
  tax: {
    name: "Tax Agent",
    title: "Ask the Tax Agent.",
    eyebrow: "Tax, GST and compliance",
    placeholder: "Ask: Are there any GST or tax risks?",
    intro:
      "Hi, I am your Tax Agent. I help review GST, tax documents, deductions, compliance risks, payable tax indicators, and filing preparation reminders. I provide informational support only, not final tax/legal advice.",
    accent: "#ffd166",
  },
  analyst: {
    name: "Financial Analyst Agent",
    title: "Ask the Financial Analyst Agent.",
    eyebrow: "Margins, ratios, and trends",
    placeholder: "Ask: What is my profit margin?",
    intro:
      "Hi, I am your Financial Analyst Agent. I focus on revenue, expenses, margins, ratios, and performance trends.",
    accent: "#ffd166",
  },
  cashflow: {
    name: "Cash Flow Agent",
    title: "Ask the Cash Flow Agent.",
    eyebrow: "Runway and liquidity",
    placeholder: "Ask: What is my cash runway?",
    intro:
      "Hi, I am your Cash Flow Agent. I focus on cash position, burn rate, runway, and liquidity risk.",
    accent: "#38bdf8",
  },
  consultant: {
    name: "Business Consultant Agent",
    title: "Ask the Business Consultant Agent.",
    eyebrow: "Growth and cost control",
    placeholder: "Ask: What costs should I cut first?",
    intro:
      "Hi, I am your Business Consultant Agent. I turn finance signals into practical growth and cost-control actions.",
    accent: "#c084fc",
  },
  risk: {
    name: "Risk & Compliance Agent",
    title: "Ask the Risk & Compliance Agent.",
    eyebrow: "Risk guardrail",
    placeholder: "Ask: What are the biggest red flags?",
    intro:
      "Hi, I am your Risk & Compliance Agent. I focus on missing approvals, rejected data, financial risks, and verification needs.",
    accent: "#ff8a95",
  },
};

const DEFAULT_STARTER_QUESTIONS = [
  "Why is my health score low?",
  "Why is my business running at a loss?",
  "What expenses should I reduce first?",
  "Are there any tax or compliance risks?",
  "How can I improve my cash flow?",
];

function normalizeAgentId(value: string | null): AgentId {
  if (
    value === "cfo" ||
    value === "accountant" ||
    value === "tax" ||
    value === "analyst" ||
    value === "cashflow" ||
    value === "consultant" ||
    value === "risk" ||
    value === "team"
  ) {
    return value;
  }

  return "team";
}

export default function BusinessChatPage() {
  const searchParams = useSearchParams();
  const agentId = normalizeAgentId(searchParams.get("agent"));
  const agent = AGENTS[agentId];

  const defaultMessages = useMemo<ChatMessage[]>(
    () => [
      {
        role: "assistant",
        content: agent.intro,
      },
    ],
    [agent.intro],
  );

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(defaultMessages);
  const [suggestions, setSuggestions] = useState(DEFAULT_STARTER_QUESTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    async function loadChatHistory() {
      setIsLoadingHistory(true);

      try {
        const response = await fetch(`/api/chat?agent=${agentId}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load chat history.");
        }

        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages(defaultMessages);
        }

        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions(DEFAULT_STARTER_QUESTIONS);
        }
      } catch (error) {
        setMessages([
          ...defaultMessages,
          {
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "Could not load saved chat history.",
          },
        ]);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadChatHistory();
  }, [agentId, defaultMessages]);

  async function askQuestion(nextQuestion?: string) {
    const finalQuestion = (nextQuestion ?? question).trim();

    if (!finalQuestion || isLoading || isLoadingHistory) {
      return;
    }

    setQuestion("");
    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: finalQuestion,
      },
    ]);

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: finalQuestion,
          agentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to get answer.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer ?? "I could not generate an answer.",
        },
      ]);

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    askQuestion();
  }

  async function clearChat() {
    if (isLoading || isClearing) {
      return;
    }

    setIsClearing(true);

    try {
      const response = await fetch("/api/chat", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to clear chat.");
      }

      setMessages(defaultMessages);
      setSuggestions(DEFAULT_STARTER_QUESTIONS);
      setQuestion("");
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Could not clear chat history.",
        },
      ]);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      <main
        style={{
          display: "grid",
          gap: 18,
          minWidth: 0,
        }}
      >
        <section
          style={{
            border: `1px solid ${agent.accent}44`,
            background:
              "radial-gradient(circle at top right, rgba(245,158,11,0.14), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.060), rgba(255,255,255,0.024))",
            borderRadius: 30,
            padding: 24,
            display: "grid",
            gap: 16,
            overflow: "hidden",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 8,
                minWidth: 0,
              }}
            >
              <p
                className="eyebrow"
                style={{
                  margin: 0,
                  color: agent.accent,
                }}
              >
                {agent.eyebrow}
              </p>

              <h1
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: "clamp(36px, 6vw, 64px)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.07em",
                  fontWeight: 780,
                }}
              >
                {agent.title}
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  maxWidth: 760,
                }}
              >
                This chat uses approved documents only. Pending and rejected
                documents are excluded from answers.
              </p>
            </div>

            <button
              type="button"
              className="btn-ghost"
              onClick={clearChat}
              disabled={isClearing || isLoading}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                color: "var(--color-text-secondary)",
                cursor: isClearing || isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isClearing ? "Clearing..." : "Clear chat"}
            </button>
          </div>

          <div
            className="agent-switcher"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {Object.entries(AGENTS).map(([id, item]) => {
              const active = id === agentId;

              return (
                <Link
                  key={id}
                  href={`/chat?agent=${id}`}
                  className="agent-chip"
                  style={{
                    border: active
                      ? `1px solid ${item.accent}88`
                      : "1px solid rgba(255,255,255,0.11)",
                    background: active
                      ? `${item.accent}18`
                      : "rgba(255,255,255,0.035)",
                    color: active ? item.accent : "var(--color-text-secondary)",
                    textDecoration: "none",
                    borderRadius: 999,
                    padding: "8px 11px",
                    fontSize: 11,
                    lineHeight: 1,
                    fontWeight: active ? 720 : 560,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </section>

        <section
          className="chat-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 16,
            alignItems: "start",
          }}
        >
          <article
            style={{
              border: "1px solid rgba(255,209,102,0.14)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.022))",
              borderRadius: 26,
              padding: 18,
              display: "grid",
              gap: 14,
              minWidth: 0,
            }}
          >
            <div
              className="chat-messages"
              style={{
                minHeight: 440,
                maxHeight: "62dvh",
                overflowY: "auto",
                display: "grid",
                gap: 12,
                paddingRight: 4,
              }}
            >
              {isLoadingHistory ? (
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 20,
                    padding: 16,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                  }}
                >
                  Loading saved chat history...
                </div>
              ) : (
                messages.map((message, index) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={`${message.role}-${index}-${message.createdAt ?? ""}`}
                      style={{
                        display: "grid",
                        justifyItems: isUser ? "end" : "start",
                      }}
                    >
                      <div
                        style={{
                          width: "min(760px, 92%)",
                          border: isUser
                            ? "1px solid rgba(255,209,102,0.24)"
                            : `1px solid ${agent.accent}33`,
                          background: isUser
                            ? "rgba(245,158,11,0.085)"
                            : "rgba(255,255,255,0.045)",
                          borderRadius: isUser
                            ? "22px 22px 6px 22px"
                            : "22px 22px 22px 6px",
                          padding: 14,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <strong
                          style={{
                            color: isUser ? "var(--color-gold)" : agent.accent,
                            fontSize: 12,
                            lineHeight: 1,
                            fontWeight: 720,
                          }}
                        >
                          {isUser ? "You" : agent.name}
                        </strong>

                        <p
                          style={{
                            margin: 0,
                            color: "var(--color-text-primary)",
                            fontSize: 14,
                            lineHeight: 1.72,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {message.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}

              {isLoading ? (
                <div
                  style={{
                    width: "min(760px, 92%)",
                    border: `1px solid ${agent.accent}33`,
                    background: "rgba(255,255,255,0.045)",
                    borderRadius: "22px 22px 22px 6px",
                    padding: 14,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {agent.name} is analyzing approved financial data...
                </div>
              ) : null}
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={agent.placeholder}
                disabled={isLoading || isLoadingHistory}
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.16)",
                  color: "var(--color-text-primary)",
                  borderRadius: 20,
                  padding: 14,
                  fontSize: 14,
                  lineHeight: 1.6,
                  outline: "none",
                }}
              />

              <button
                type="submit"
                className="btn-ghost"
                disabled={isLoading || isLoadingHistory || !question.trim()}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  border: `1px solid ${agent.accent}66`,
                  background: `${agent.accent}14`,
                  color: agent.accent,
                  cursor:
                    isLoading || isLoadingHistory || !question.trim()
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    isLoading || isLoadingHistory || !question.trim() ? 0.65 : 1,
                }}
              >
                {isLoading ? "Analyzing..." : "Ask Actic Finance"}
              </button>
            </form>
          </article>

          <aside
            style={{
              border: "1px solid rgba(255,209,102,0.14)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.050), rgba(255,255,255,0.020))",
              borderRadius: 26,
              padding: 18,
              display: "grid",
              gap: 14,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 6,
              }}
            >
              <p
                className="eyebrow"
                style={{
                  margin: 0,
                  color: agent.accent,
                }}
              >
                Suggested questions
              </p>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Use these to quickly test the selected agent.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              {suggestions.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => askQuestion(starter)}
                  disabled={isLoading || isLoadingHistory}
                  style={{
                    border: "1px solid rgba(255,255,255,0.11)",
                    background: "rgba(255,255,255,0.040)",
                    color: "var(--color-text-secondary)",
                    borderRadius: 18,
                    padding: 12,
                    cursor:
                      isLoading || isLoadingHistory ? "not-allowed" : "pointer",
                    fontSize: 12,
                    lineHeight: 1.5,
                    textAlign: "left",
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </aside>
        </section>
      </main>

      <style>
        {`
          .chat-messages::-webkit-scrollbar {
            width: 5px;
          }

          .chat-messages::-webkit-scrollbar-track {
            background: transparent;
          }

          .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(255,209,102,0.28);
            border-radius: 999px;
          }

          @media (max-width: 980px) {
            .chat-layout {
              grid-template-columns: 1fr !important;
            }

            .agent-switcher {
              flex-wrap: nowrap !important;
              overflow-x: auto !important;
              padding-bottom: 4px !important;
              scrollbar-width: none !important;
            }

            .agent-switcher::-webkit-scrollbar {
              display: none !important;
            }

            .agent-chip {
              flex: 0 0 auto !important;
            }
          }

          @media (max-width: 560px) {
            .chat-messages {
              min-height: 380px !important;
              max-height: 58dvh !important;
            }
          }
        `}
      </style>
    </>
  );
}