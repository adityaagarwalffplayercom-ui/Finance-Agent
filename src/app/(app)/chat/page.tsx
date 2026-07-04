"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type AiAgentId =
  | "overall"
  | "cfo"
  | "accountant"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

type AgentOption = {
  id: AiAgentId;
  name: string;
  shortName: string;
  role: string;
  icon: string;
  description: string;
};

const AGENTS: AgentOption[] = [
  {
    id: "overall",
    name: "Overall Finance Team",
    shortName: "Overall",
    role: "Complete AI finance team",
    icon: "🤖",
    description:
      "General chat combining CFO, accountant, analyst, cash flow, consultant, and risk views.",
  },
  {
    id: "cfo",
    name: "CFO Agent",
    shortName: "CFO",
    role: "Executive finance decision maker",
    icon: "📊",
    description: "Financial health, profit, risk, and next decisions.",
  },
  {
    id: "accountant",
    name: "Accountant Agent",
    shortName: "Accountant",
    role: "Books and document control",
    icon: "📚",
    description: "Missing documents, data quality, and accounting gaps.",
  },
  {
    id: "analyst",
    name: "Financial Analyst Agent",
    shortName: "Analyst",
    role: "Ratios and performance analysis",
    icon: "📈",
    description: "Margins, expense ratio, coverage, and trends.",
  },
  {
    id: "cashflow",
    name: "Cash Flow Agent",
    shortName: "Cash Flow",
    role: "Liquidity and runway monitor",
    icon: "💧",
    description: "Cash runway, burn rate, bank data, and liquidity.",
  },
  {
    id: "consultant",
    name: "Business Consultant Agent",
    shortName: "Consultant",
    role: "Growth and cost-control advisor",
    icon: "🧠",
    description: "Strategy, pricing, cost control, and action plans.",
  },
  {
    id: "risk",
    name: "Risk & Compliance Agent",
    shortName: "Risk",
    role: "Financial risk guardrail",
    icon: "🛡️",
    description: "Warnings, weak signals, missing data, and red flags.",
  },
];

const DEFAULT_STARTER_QUESTIONS = [
  "Give me an overall summary of my business.",
  "What is the current financial condition of my business?",
  "What should I fix first?",
  "What are my biggest risks and opportunities?",
  "Give me a complete action plan.",
];

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I am your Overall Finance Team. I can answer like a CFO, accountant, financial analyst, cash flow manager, business consultant, and risk manager together. Choose a specialist agent only when you want a focused answer.",
  },
];

function isValidAgent(agent: string | null): agent is AiAgentId {
  return (
    agent === "overall" ||
    agent === "cfo" ||
    agent === "accountant" ||
    agent === "analyst" ||
    agent === "cashflow" ||
    agent === "consultant" ||
    agent === "risk"
  );
}

function getInitialAgent(): AiAgentId {
  if (typeof window === "undefined") return "overall";

  const agent = new URLSearchParams(window.location.search).get("agent");

  if (isValidAgent(agent)) {
    return agent;
  }

  return "overall";
}

function formatMessage(content: string) {
  return content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() || lines[index - 1]?.trim())
    .join("\n");
}

export default function BusinessChatPage() {
  const [selectedAgent, setSelectedAgent] = useState<AiAgentId>("overall");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [suggestions, setSuggestions] = useState(DEFAULT_STARTER_QUESTIONS);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setSelectedAgent(getInitialAgent());
  }, []);

  const activeAgent = useMemo(
    () => AGENTS.find((agent) => agent.id === selectedAgent) ?? AGENTS[0],
    [selectedAgent],
  );

  useEffect(() => {
    async function loadChatHistory() {
      setIsLoadingHistory(true);

      try {
        const response = await fetch(`/api/chat?agent=${selectedAgent}`, {
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
          setMessages([
            {
              role: "assistant",
              content:
                selectedAgent === "overall"
                  ? "Hi, I am your Overall Finance Team. Ask me anything about your approved financial data, dashboard, risks, documents, cash flow, or next actions."
                  : `Hi, I am your ${activeAgent.name}. ${activeAgent.description}`,
            },
          ]);
        }

        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions(DEFAULT_STARTER_QUESTIONS);
        }
      } catch (error) {
        setMessages([
          ...DEFAULT_MESSAGES,
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
  }, [
    selectedAgent,
    activeAgent.name,
    activeAgent.description,
  ]);

  async function askQuestion(nextQuestion?: string) {
    const finalQuestion = (nextQuestion ?? question).trim();

    if (!finalQuestion || isLoading || isLoadingHistory) return;

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
          agentId: selectedAgent,
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
    if (isLoading || isClearing) return;

    setIsClearing(true);

    try {
      const response = await fetch("/api/chat", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to clear chat.");
      }

      setMessages([
        {
          role: "assistant",
          content:
            selectedAgent === "overall"
              ? "Chat cleared. I am your Overall Finance Team. Ask me anything about your approved financial data."
              : `Chat cleared. I am your ${activeAgent.name}. Ask me anything about your approved financial data.`,
        },
      ]);

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

  function changeAgent(agentId: AiAgentId) {
    setSelectedAgent(agentId);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);

      if (agentId === "overall") {
        url.searchParams.delete("agent");
      } else {
        url.searchParams.set("agent", agentId);
      }

      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">AI finance team</p>
          <h1>Ask your business anything.</h1>
        </div>

        <span className="badge-sample">
          Active mode · {activeAgent.shortName}
        </span>
      </header>

      <p className="page-intro">
        Use Overall Finance Team for general answers, or choose a specialist
        agent for CFO, accounting, analysis, cash flow, consulting, or risk.
        Answers use only approved documents.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 0.75fr) minmax(0, 1.5fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <aside
          className="alerts-card"
          style={{
            display: "grid",
            gap: 14,
            position: "sticky",
            top: 24,
          }}
        >
          <div>
            <p className="section-title">Choose chat mode</p>
            <p className="section-hint">
              Overall mode gives a complete answer. Specialist agents go deeper
              into one finance area.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {AGENTS.map((agent) => {
              const active = agent.id === selectedAgent;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => changeAgent(agent.id)}
                  disabled={isLoading || isLoadingHistory}
                  style={{
                    border: active
                      ? "1px solid rgba(245,158,11,0.55)"
                      : "1px solid var(--color-border)",
                    background: active
                      ? "rgba(245,158,11,0.12)"
                      : "rgba(255,255,255,0.03)",
                    color: "var(--color-text-primary)",
                    borderRadius: 16,
                    padding: 13,
                    cursor:
                      isLoading || isLoadingHistory ? "not-allowed" : "pointer",
                    textAlign: "left",
                    display: "grid",
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--color-border)",
                        background: "rgba(255,255,255,0.04)",
                        fontSize: 17,
                      }}
                    >
                      {agent.icon}
                    </span>

                    <span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 900,
                        }}
                      >
                        {agent.name}
                      </span>

                      <span
                        style={{
                          display: "block",
                          color: "var(--color-text-secondary)",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {agent.role}
                      </span>
                    </span>
                  </span>

                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    {agent.description}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main
          className="alerts-card"
          style={{
            display: "grid",
            gap: 18,
            minHeight: 680,
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
              <p className="section-title">{activeAgent.name}</p>
              <p className="section-hint">{activeAgent.description}</p>
            </div>

            <button
              type="button"
              onClick={clearChat}
              disabled={isLoading || isClearing}
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-text-secondary)",
                borderRadius: 12,
                padding: "9px 12px",
                cursor: isLoading || isClearing ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {isClearing ? "Clearing..." : "Clear chat"}
            </button>
          </div>

          <section
            style={{
              border: "1px solid var(--color-border)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              borderRadius: 18,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 5px",
                  color: "var(--color-text-primary)",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                Suggested questions
              </p>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                Click one to test this chat mode during demo.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {suggestions.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => askQuestion(starter)}
                  disabled={isLoading || isLoadingHistory}
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--color-text-primary)",
                    borderRadius: 999,
                    padding: "9px 12px",
                    cursor:
                      isLoading || isLoadingHistory ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 750,
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </section>

          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              minHeight: 360,
              maxHeight: 560,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {isLoadingHistory ? (
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--color-text-secondary)",
                  borderRadius: 16,
                  padding: 16,
                  fontSize: 14,
                }}
              >
                Loading saved chat history...
              </div>
            ) : (
              messages.map((message, index) => {
                const isUser = message.role === "user";

                return (
                  <article
                    key={`${message.createdAt ?? "message"}-${index}`}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      width: "min(100%, 760px)",
                      border: "1px solid var(--color-border)",
                      background: isUser
                        ? "rgba(245,158,11,0.10)"
                        : "rgba(255,255,255,0.035)",
                      borderRadius: 18,
                      padding: 15,
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        color: isUser
                          ? "var(--color-amber)"
                          : "var(--color-text-primary)",
                        fontSize: 12,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {isUser ? "You" : activeAgent.name}
                    </p>

                    <p
                      style={{
                        margin: 0,
                        color: "var(--color-text-secondary)",
                        fontSize: 14,
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {formatMessage(message.content)}
                    </p>
                  </article>
                );
              })
            )}

            {isLoading && (
              <article
                style={{
                  alignSelf: "flex-start",
                  width: "min(100%, 760px)",
                  border: "1px solid rgba(255,193,7,0.25)",
                  background: "rgba(255,193,7,0.08)",
                  borderRadius: 18,
                  padding: 15,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "#ffd166",
                    fontSize: 14,
                    fontWeight: 850,
                  }}
                >
                  {activeAgent.name} is analyzing your approved financial data...
                </p>
              </article>
            )}
          </section>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              borderTop: "1px solid var(--color-border)",
              paddingTop: 16,
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={`Ask ${activeAgent.shortName}: ${
                suggestions[0] ?? "What should I do next?"
              }`}
              disabled={isLoading || isLoadingHistory}
              style={{
                width: "100%",
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-text-primary)",
                borderRadius: 14,
                padding: "13px 14px",
                outline: "none",
                fontSize: 14,
              }}
            />

            <button
              type="submit"
              disabled={!question.trim() || isLoading || isLoadingHistory}
              style={{
                border: "none",
                background: "var(--color-amber)",
                color: "var(--color-base)",
                borderRadius: 14,
                padding: "13px 18px",
                cursor:
                  !question.trim() || isLoading || isLoadingHistory
                    ? "not-allowed"
                    : "pointer",
                fontSize: 14,
                fontWeight: 900,
                opacity:
                  !question.trim() || isLoading || isLoadingHistory ? 0.65 : 1,
                whiteSpace: "nowrap",
              }}
            >
              Send
            </button>
          </form>
        </main>
      </section>
    </>
  );
}