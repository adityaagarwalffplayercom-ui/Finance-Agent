"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_QUESTIONS = [
  "Why is my health score low?",
  "Why is my business running at a loss?",
  "What expenses should I reduce first?",
  "How can I improve my cash flow?",
  "Can I afford to hire another employee?",
];

export default function BusinessChatPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I am your AI finance team. Ask me about your revenue, expenses, profit, cash flow, risks, or what action you should take next.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  async function askQuestion(nextQuestion?: string) {
    const finalQuestion = (nextQuestion ?? question).trim();

    if (!finalQuestion || isLoading) return;

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    askQuestion();
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">AI finance team</p>
          <h1>Ask your business anything.</h1>
        </div>

        <span className="badge-sample">
          Answers are based on processed financial documents
        </span>
      </header>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <div>
          <p className="section-title">Business chat</p>
          <p className="section-hint">
            Ask questions about profit, expenses, cash flow, risk, and next actions.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {STARTER_QUESTIONS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => askQuestion(starter)}
              disabled={isLoading}
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-text-secondary)",
                borderRadius: 999,
                padding: "9px 12px",
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              {starter}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            maxHeight: 520,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                justifySelf: message.role === "user" ? "end" : "start",
                maxWidth: "82%",
                border: "1px solid var(--color-border)",
                background:
                  message.role === "user"
                    ? "rgba(88,166,255,0.12)"
                    : "rgba(255,255,255,0.04)",
                borderRadius: 18,
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-secondary)",
                }}
              >
                {message.role === "user" ? "You" : "AI finance team"}
              </p>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {message.content}
              </p>
            </div>
          ))}

          {isLoading && (
            <div
              style={{
                justifySelf: "start",
                maxWidth: "82%",
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 18,
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                }}
              >
                Analyzing your financial data...
              </p>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12,
            marginTop: 8,
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask: Why is my business running at a loss?"
            disabled={isLoading}
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
            disabled={isLoading || !question.trim()}
            style={{
              border: "1px solid var(--color-border)",
              background: isLoading
                ? "rgba(255,255,255,0.06)"
                : "var(--color-accent)",
              color: "white",
              borderRadius: 14,
              padding: "0 18px",
              cursor: isLoading || !question.trim() ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            Send
          </button>
        </form>
      </section>
    </>
  );
}