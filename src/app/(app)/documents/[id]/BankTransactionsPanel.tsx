import type { ExtractedDocumentData } from "@/lib/gemini";

type Props = {
  extractedData: ExtractedDocumentData | null;
  currency: string;
};

type BankTransaction = {
  date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
};

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : null;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTransactions(
  data: ExtractedDocumentData | null,
): BankTransaction[] {
  if (!Array.isArray(data?.transactions)) {
    return [];
  }

  return data.transactions.flatMap<BankTransaction>((transaction) => {
    const date = cleanText(transaction.date);
    const description = cleanText(transaction.description);
    const amount = cleanNumber(transaction.amount);
    const direction =
      transaction.direction === "credit" || transaction.direction === "debit"
        ? transaction.direction
        : null;

    if (!date || !description || amount === null || amount === 0 || !direction) {
      return [];
    }

    return [
      {
        date,
        description,
        amount: Math.abs(amount),
        direction,
      },
    ];
  });
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = cleanNumber(value);

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) {
    return "Not found";
  }

  const symbols: Record<string, string> = {
    INR: "Rs. ",
    USD: "$",
    EUR: "€",
    GBP: "£",
    CHF: "CHF ",
  };

  const normalizedCurrency = currency.toUpperCase();
  const symbol = symbols[normalizedCurrency] ?? `${normalizedCurrency} `;

  return `${symbol}${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "green" | "red" | "blue" | "neutral";
}) {
  const styles = {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.25)",
      background: "rgba(46,213,115,0.08)",
    },
    red: {
      color: "#ff8a95",
      border: "rgba(255,71,87,0.25)",
      background: "rgba(255,71,87,0.08)",
    },
    blue: {
      color: "#8abfff",
      border: "rgba(88,166,255,0.25)",
      background: "rgba(88,166,255,0.08)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.035)",
    },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${styles.border}`,
        background: styles.background,
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 8,
        minHeight: 118,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 23,
          lineHeight: 1.1,
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: styles.color,
          fontSize: 12,
          fontWeight: 750,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

export function BankTransactionsPanel({ extractedData, currency }: Props) {
  const transactions = normalizeTransactions(extractedData);
  const totalCredits = transactions.reduce(
    (total, transaction) =>
      transaction.direction === "credit"
        ? total + transaction.amount
        : total,
    0,
  );
  const totalDebits = transactions.reduce(
    (total, transaction) =>
      transaction.direction === "debit"
        ? total + transaction.amount
        : total,
    0,
  );
  const netMovement = totalCredits - totalDebits;
  const openingBalance = firstNumber(extractedData?.openingBalance);
  const closingBalance = firstNumber(
    extractedData?.closingBalance,
    extractedData?.balance,
    extractedData?.cash,
    extractedData?.totalAmount,
  );

  return (
    <section
      className="section-card"
      style={{
        marginBottom: 24,
        display: "grid",
        gap: 18,
      }}
    >
      <div
        className="section-heading"
        style={{
          alignItems: "flex-start",
        }}
      >
        <div>
          <p className="section-title">Extracted bank transactions</p>
          <p className="section-hint">
            Every posted credit and debit saved from this bank statement.
            Credits and debits are cash movements; they are not automatically
            treated as revenue or expenses without accounting classification.
          </p>
        </div>

        <span className="badge-sample">
          {transactions.length.toLocaleString("en-IN")} transaction
          {transactions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryCard
          label="Opening balance"
          value={formatMoney(openingBalance, currency)}
          hint="Statement opening balance"
          tone="blue"
        />
        <SummaryCard
          label="Closing balance"
          value={formatMoney(closingBalance, currency)}
          hint="Statement ending balance"
          tone="blue"
        />
        <SummaryCard
          label="Total credits"
          value={formatMoney(totalCredits, currency)}
          hint="Money entering the account"
          tone="green"
        />
        <SummaryCard
          label="Total debits"
          value={formatMoney(totalDebits, currency)}
          hint="Money leaving the account"
          tone="red"
        />
        <SummaryCard
          label="Net movement"
          value={formatMoney(netMovement, currency)}
          hint="Credits minus debits"
          tone={netMovement > 0 ? "green" : netMovement < 0 ? "red" : "neutral"}
        />
        <SummaryCard
          label="Transactions"
          value={transactions.length.toLocaleString("en-IN")}
          hint="Rows available for review"
          tone="neutral"
        />
      </div>

      {transactions.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--color-border)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 18,
            padding: 20,
            color: "var(--color-text-secondary)",
            fontSize: 14,
          }}
        >
          No valid bank transactions are available in the saved extraction.
        </div>
      ) : (
        <div
          style={{
            overflow: "auto",
            maxHeight: 720,
            border: "1px solid var(--color-border)",
            borderRadius: 18,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 800,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--color-surface, #171b22)",
                }}
              >
                {["Date", "Description", "Direction", "Amount"].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: "var(--color-surface, #171b22)",
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      textAlign: heading === "Amount" ? "right" : "left",
                      padding: 13,
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction, index) => {
                const isCredit = transaction.direction === "credit";

                return (
                  <tr
                    key={`${transaction.date}-${transaction.description}-${index}`}
                  >
                    <td
                      style={{
                        padding: 13,
                        color: "var(--color-text-secondary)",
                        fontSize: 13,
                        borderBottom: "1px solid var(--color-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(transaction.date)}
                    </td>

                    <td
                      style={{
                        padding: 13,
                        color: "var(--color-text-primary)",
                        fontSize: 13,
                        borderBottom: "1px solid var(--color-border)",
                        minWidth: 360,
                      }}
                    >
                      {transaction.description}
                    </td>

                    <td
                      style={{
                        padding: 13,
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          border: `1px solid ${
                            isCredit
                              ? "rgba(46,213,115,0.28)"
                              : "rgba(255,71,87,0.28)"
                          }`,
                          background: isCredit
                            ? "rgba(46,213,115,0.08)"
                            : "rgba(255,71,87,0.08)",
                          color: isCredit ? "#7bed9f" : "#ff8a95",
                          borderRadius: 999,
                          padding: "5px 9px",
                          fontSize: 11,
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
                      >
                        {transaction.direction}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: 13,
                        color: isCredit ? "#7bed9f" : "#ff8a95",
                        fontSize: 13,
                        fontWeight: 850,
                        textAlign: "right",
                        borderBottom: "1px solid var(--color-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isCredit ? "+" : "−"}
                      {formatMoney(transaction.amount, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
