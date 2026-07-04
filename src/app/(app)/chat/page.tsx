"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type AgentId =
  | "team"
  | "cfo"
  | "accountant"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

const AGENTS: Record<
  AgentId,
  {
    name: string;
    title: string;
    eyebrow: string;
    placeholder: string;
    intro: string;
    accent: string;
  }
> = {
  team: {
    name: "AI Finance Team",
    title: "Ask your business anything.",
    eyebrow: "AI finance team",
    placeholder: "Ask: Why is my business running at a loss?",
    intro:
      "Hi, I am your AI finance team. Ask me about revenue, expenses, profit, cash flow, risks, or next actions.",
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
  "How can I improve my cash flow?",
  "Can I afford to hire another employee?",
];

function normalizeAgentId(value: string | null): AgentId {
  if (
    value === "cfo" ||
    value === "accountant" ||
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
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{agent.eyebrow}</p>
          <h1>{agent.title}</h1>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 999,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: agent.accent,
              boxShadow: `0 0 12px ${agent.accent}`,
            }}
          />
          {agent.name}
        </div>
      </header>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p className="section-title">Business chat</p>
            <p className="section-hint">
              This chat uses approved documents only. Pending and rejected
              documents are excluded from answers.
            </p>
          </div>

          <button
            type="button"
            onClick={clearChat}
            disabled={isClearing || isLoading}
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-secondary)",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 800,
              cursor: isClearing || isLoading ? "not-allowed" : "pointer",
              opacity: isClearing || isLoading ? 0.6 : 1,
            }}
          >
            {isClearing ? "Clearing..." : "Clear chat"}
          </button>
        </div>

        <div>
          <p
            style={{
              margin: "0 0 10px",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 800,
            }}
          >
            Suggested questions
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
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
                  border: "1px solid var(--color-border)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--color-text-secondary)",
                  borderRadius: 999,
                  padding: "9px 12px",
                  cursor:
                    isLoading || isLoadingHistory ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 16,
          marginBottom: 18,
          minHeight: 360,
        }}
      >
        {isLoadingHistory ? (
          <p
            style={{
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            Loading saved chat history...
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                justifySelf: message.role === "user" ? "end" : "start",
                maxWidth: "82%",
                border: "1px solid var(--color-border)",
                background:
                  message.role === "user"
                    ? "rgba(59,130,246,0.14)"
                    : "rgba(255,255,255,0.04)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  color:
                    message.role === "user"
                      ? "#8abfff"
                      : "var(--color-text-secondary)",
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {message.role === "user" ? "You" : agent.name}
              </p>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                }}
              >
                {message.content}
              </p>
            </div>
          ))
        )}

        {isLoading && (
          <div
            style={{
              justifySelf: "start",
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 16,
              padding: 14,
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            {agent.name} is analyzing approved financial data...
          </div>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={agent.placeholder}
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
          disabled={isLoading || isLoadingHistory || !question.trim()}
          style={{
            border: "1px solid rgba(255,255,255,0.16)",
            background: "linear-gradient(135deg, var(--color-accent), #7c3aed)",
            color: "white",
            borderRadius: 14,
            padding: "13px 17px",
            fontSize: 14,
            fontWeight: 900,
            cursor:
              isLoading || isLoadingHistory || !question.trim()
                ? "not-allowed"
                : "pointer",
            opacity: isLoading || isLoadingHistory || !question.trim() ? 0.65 : 1,
          }}
        >
          Send
        </button>
      </form>
    </>
  );
}